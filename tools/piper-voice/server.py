#!/usr/bin/env python3
"""Hosted Piper TTS and static web server for StickMotion AI.

Voice models are installed in the server image. End users only use /api/tts;
they never download Python, Piper, or model files.
"""
from __future__ import annotations

import io
import json
import logging
import math
import os
import time
import wave
from collections import defaultdict, deque
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import BoundedSemaphore, Lock
from urllib.parse import urlsplit
from typing import Any

from piper import PiperVoice, SynthesisConfig

MAX_TEXT_LENGTH = 4000
MAX_BODY_BYTES = 20_000
RATE_LIMIT_REQUESTS = 10
RATE_LIMIT_WINDOW_SECONDS = 60
VOICE_PATHS: dict[str, Path] = {}
VOICES: dict[str, PiperVoice] = {}
VOICE_LOCK = Lock()
RATE_LOCK = Lock()
REQUESTS: dict[str, deque[float]] = defaultdict(deque)
SYNTHESIS_SLOT = BoundedSemaphore(1)
STYLE_CONFIG = {
    "documentary": {"noise_scale": 0.667, "noise_w_scale": 0.8},
    "energetic": {"noise_scale": 0.8, "noise_w_scale": 0.9},
    "calm": {"noise_scale": 0.55, "noise_w_scale": 0.7},
}


def load_voice(language: str) -> PiperVoice:
    if language in VOICES:
        return VOICES[language]
    path = VOICE_PATHS.get(language)
    if path is None or not path.is_file():
        raise FileNotFoundError(f"The {language} voice model is not configured on this server.")
    with VOICE_LOCK:
        if language not in VOICES:
            VOICES[language] = PiperVoice.load(str(path))
    return VOICES[language]


class Handler(SimpleHTTPRequestHandler):
    server_version = "StickMotionCloudVoice/1.0"

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        web_root = os.environ.get("WEB_DIST_DIR", "dist")
        super().__init__(*args, directory=web_root, **kwargs)

    def _origin_allowed(self) -> bool:
        origin = self.headers.get("Origin", "")
        if not origin:
            return True
        allowed = self.server.allowed_origins
        if origin in allowed:
            return True
        # Same-origin production requests need no separately configured CORS entry.
        return urlsplit(origin).netloc == self.headers.get("Host", "")

    def _cors(self) -> None:
        origin = self.headers.get("Origin", "")
        if origin and self._origin_allowed():
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, status: int, payload: dict[str, Any]) -> None:
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _client_key(self) -> str:
        forwarded = self.headers.get("X-Forwarded-For", "")
        return forwarded.split(",")[-1].strip() if forwarded else self.client_address[0]

    def _rate_limited(self) -> bool:
        now = time.monotonic()
        key = self._client_key()
        with RATE_LOCK:
            requests = REQUESTS[key]
            while requests and now - requests[0] > RATE_LIMIT_WINDOW_SECONDS:
                requests.popleft()
            if len(requests) >= RATE_LIMIT_REQUESTS:
                return True
            requests.append(now)
        return False

    def do_OPTIONS(self) -> None:
        if self.path != "/api/tts" or not self._origin_allowed():
            self._json(403, {"error": "This origin or endpoint is not allowed."})
            return
        self.send_response(204)
        self._cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self) -> None:
        if self.path == "/health":
            self._json(200, {
                "service": "StickMotion Cloud Voice",
                "status": "ready",
                "languages": {
                    "en": {"configured": "en" in VOICE_PATHS, "loaded": "en" in VOICES},
                    "ar": {"configured": "ar" in VOICE_PATHS, "loaded": "ar" in VOICES},
                },
            })
            return
        if self.path.startswith("/api/"):
            self._json(404, {"error": "API route not found."})
            return
        super().do_GET()

    def do_POST(self) -> None:
        if self.path != "/api/tts":
            self._json(404, {"error": "API route not found."})
            return
        if not self._origin_allowed():
            self._json(403, {"error": "This origin is not allowed."})
            return
        if self._rate_limited():
            self._json(429, {"error": "Voice request limit reached. Please wait a minute and try again."})
            return
        if not SYNTHESIS_SLOT.acquire(blocking=False):
            self._json(429, {"error": "The voice service is busy. Please retry shortly."})
            return
        try:
            content_type = self.headers.get("Content-Type", "")
            if "application/json" not in content_type.lower():
                self._json(415, {"error": "Send the narration as application/json."})
                return
            try:
                size = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                size = 0
            if size <= 0 or size > MAX_BODY_BYTES:
                self._json(413, {"error": "Request body is too large or empty."})
                return
            request = json.loads(self.rfile.read(size))
            if not isinstance(request, dict):
                self._json(400, {"error": "Request must be a JSON object."})
                return
            text = request.get("text", "")
            language = request.get("language", "")
            style = request.get("style", "documentary")
            rate = float(request.get("rate", 1.0))
            if not isinstance(text, str) or not text.strip() or len(text) > MAX_TEXT_LENGTH:
                self._json(400, {"error": f"Text must contain 1–{MAX_TEXT_LENGTH} characters."})
                return
            if language not in {"en", "ar"}:
                self._json(400, {"error": "Language must be en or ar."})
                return
            if style not in STYLE_CONFIG:
                self._json(400, {"error": "Style must be documentary, energetic, or calm."})
                return
            if not math.isfinite(rate) or rate < 0.7 or rate > 1.3:
                self._json(400, {"error": "Rate must be between 0.7 and 1.3."})
                return
            voice = load_voice(language)
            audio = io.BytesIO()
            with wave.open(audio, "wb") as wav_file:
                voice.synthesize_wav(
                    text.strip(),
                    wav_file,
                    syn_config=SynthesisConfig(
                        length_scale=1.0 / rate,
                        **STYLE_CONFIG[style],
                    ),
                )
            wav = audio.getvalue()
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", "audio/wav")
            self.send_header("Content-Length", str(len(wav)))
            self.send_header("Content-Disposition", 'attachment; filename="stickmotion-narration.wav"')
            self.end_headers()
            self.wfile.write(wav)
        except FileNotFoundError as error:
            self._json(503, {"error": str(error)})
        except (ValueError, TypeError, json.JSONDecodeError) as error:
            self._json(400, {"error": f"Invalid request: {error}"})
        except Exception:
            logging.exception("Piper synthesis failed")
            self._json(500, {"error": "Voice generation failed. Please retry shortly."})
        finally:
            SYNTHESIS_SLOT.release()

    def log_message(self, fmt: str, *args: Any) -> None:
        logging.info("%s - %s", self.address_string(), fmt % args)


def main() -> None:
    for language, variable, default in (
        ("en", "PIPER_EN_MODEL", "voices/en_US-ryan-medium.onnx"),
        ("ar", "PIPER_AR_MODEL", "voices/ar_JO-kareem-medium.onnx"),
    ):
        configured = os.environ.get(variable, default)
        path = Path(configured).expanduser()
        if path.is_file():
            VOICE_PATHS[language] = path.resolve()

    allowed_origins = {
        origin.strip()
        for origin in os.environ.get(
            "ALLOWED_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173",
        ).split(",")
        if origin.strip()
    }
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8765"))
    server = ThreadingHTTPServer((host, port), Handler)
    server.daemon_threads = True
    server.allowed_origins = allowed_origins
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    logging.info("StickMotion Cloud Voice listening on %s:%s", host, port)
    logging.info("Static app directory: %s", os.environ.get("WEB_DIST_DIR", "dist"))
    logging.info("Configured voice languages: %s", ", ".join(sorted(VOICE_PATHS)) or "none")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logging.info("Stopping StickMotion Cloud Voice")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
