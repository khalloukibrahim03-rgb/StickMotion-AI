#!/usr/bin/env python3
"""Loopback-only Piper TTS bridge for StickMotion AI.

Install: python -m pip install piper-tts
Run with local ONNX voice models; no cloud API or network model download is used.
"""
from __future__ import annotations

import argparse
import io
import json
import logging
import math
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock
from typing import Any

from piper import PiperVoice, SynthesisConfig

MAX_TEXT_LENGTH = 5000
VOICES: dict[str, PiperVoice] = {}
VOICE_PATHS: dict[str, Path] = {}
VOICE_LOCK = Lock()


def load_voice(language: str) -> PiperVoice:
    if language in VOICES:
        return VOICES[language]
    path = VOICE_PATHS.get(language)
    if path is None or not path.is_file():
        raise FileNotFoundError(f"No {language} voice model configured.")
    with VOICE_LOCK:
        if language not in VOICES:
            VOICES[language] = PiperVoice.load(str(path))
    return VOICES[language]


class Handler(BaseHTTPRequestHandler):
    server_version = "StickMotionPiper/1.0"

    def _cors(self) -> None:
        origin = self.headers.get("Origin", "")
        if origin in self.server.allowed_origins:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Allow-Private-Network", "true")

    def _json(self, status: int, payload: dict[str, Any]) -> None:
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _valid_host(self) -> bool:
        return self.headers.get("Host", "") in {"127.0.0.1:8765", "localhost:8765"}

    def do_OPTIONS(self) -> None:
        if not self._valid_host():
            self.send_error(403, "Loopback host only")
            return
        origin = self.headers.get("Origin", "")
        if origin not in self.server.allowed_origins:
            self.send_error(403, "Origin is not allowed; restart with --origin")
            return
        self.send_response(204)
        self._cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self) -> None:
        if not self._valid_host():
            self._json(403, {"error": "Loopback host only"})
            return
        if self.path != "/health":
            self._json(404, {"error": "Not found"})
            return
        self._json(200, {
            "service": "StickMotion Pro Voice · Piper local",
            "languages": {
                "en": {"configured": "en" in VOICE_PATHS, "loaded": "en" in VOICES},
                "ar": {"configured": "ar" in VOICE_PATHS, "loaded": "ar" in VOICES},
            },
        })

    def do_POST(self) -> None:
        if not self._valid_host():
            self._json(403, {"error": "Loopback host only"})
            return
        if self.path != "/tts":
            self._json(404, {"error": "Not found"})
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if size <= 0 or size > 24_000:
                self._json(413, {"error": "Request body must be between 1 and 24000 bytes."})
                return
            request = json.loads(self.rfile.read(size))
            text = request.get("text", "")
            language = request.get("language", "")
            rate = float(request.get("rate", 1.0))
            if not isinstance(text, str) or not text.strip() or len(text) > MAX_TEXT_LENGTH:
                self._json(400, {"error": "Text must contain 1–5000 characters."})
                return
            if language not in {"en", "ar"}:
                self._json(400, {"error": "Language must be en or ar."})
                return
            if not math.isfinite(rate) or rate < 0.7 or rate > 1.3:
                self._json(400, {"error": "Rate must be between 0.7 and 1.3."})
                return
            voice = load_voice(language)
            audio = io.BytesIO()
            voice.synthesize_wav(
                text.strip(),
                audio,
                syn_config=SynthesisConfig(length_scale=1.0 / rate),
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
            self._json(409, {"error": str(error)})
        except (ValueError, TypeError, json.JSONDecodeError) as error:
            self._json(400, {"error": f"Invalid request: {error}"})
        except Exception:
            logging.exception("Piper synthesis failed")
            self._json(500, {"error": "Piper synthesis failed. Check the local server console."})

    def log_message(self, fmt: str, *args: Any) -> None:
        logging.info("%s - %s", self.address_string(), fmt % args)


def main() -> None:
    parser = argparse.ArgumentParser(description="Local Piper TTS bridge for StickMotion AI")
    parser.add_argument("--english-model", type=Path, help="Path to an English Piper .onnx voice model")
    parser.add_argument("--arabic-model", type=Path, help="Path to an Arabic Piper .onnx voice model")
    parser.add_argument("--origin", action="append", default=[], help="Allowed web app origin; may be repeated")
    args = parser.parse_args()

    for language, path in (("en", args.english_model), ("ar", args.arabic_model)):
        if path:
            VOICE_PATHS[language] = path.expanduser().resolve()
            if not VOICE_PATHS[language].is_file():
                parser.error(f"Model file does not exist: {VOICE_PATHS[language]}")

    if not VOICE_PATHS:
        parser.error("Provide at least one model using --english-model and/or --arabic-model.")

    allowed_origins = set(args.origin or ["http://localhost:5173", "http://127.0.0.1:5173"])
    server = ThreadingHTTPServer(("127.0.0.1", 8765), Handler)
    server.allowed_origins = allowed_origins
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    logging.info("StickMotion Piper bridge listening on http://127.0.0.1:8765")
    logging.info("Allowed origins: %s", ", ".join(sorted(allowed_origins)))
    logging.info("Configured languages: %s", ", ".join(sorted(VOICE_PATHS)))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logging.info("Stopping local voice service")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
