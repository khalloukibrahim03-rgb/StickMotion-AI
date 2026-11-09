# StickMotion Cloud Voice service

This folder contains the server-side Piper adapter. It is not an end-user installation guide. Visitors use the hosted StickMotion app and never install Python, Piper, or download voice models to a phone or computer.

## Production container

The repository-root `Dockerfile`:

1. Builds the React/Vite editor into `dist/`.
2. Installs the pinned `piper-tts` server dependency.
3. Downloads the English `en_US-kusal-medium` and Arabic `ar_JO-kareem-medium` ONNX models during the container image build.
4. Starts this server, which serves the editor and the same-origin `POST /api/tts` endpoint.

The default model paths are:

- `/app/voices/en_US-kusal-medium.onnx`
- `/app/voices/ar_JO-kareem-medium.onnx`

Override them with `PIPER_EN_MODEL` and `PIPER_AR_MODEL` if the image layout changes. The server listens on `0.0.0.0:$PORT` and serves static files from `WEB_DIST_DIR`.

## API contract

`POST /api/tts`

Request JSON:

```json
{
  "text": "Welcome to StickMotion AI.",
  "language": "en",
  "rate": 0.95,
  "style": "documentary"
}
```

- `language`: `en` or `ar`.
- `rate`: 0.7–1.3.
- `style`: `documentary`, `energetic`, or `calm`.
- Success: `audio/wav`.
- `GET /health`: service readiness and configured/loaded language flags.

The service caps text length and request size, applies a per-client request limit, allows one synthesis at a time, and keeps only one language model resident in memory. Same-origin production requests need no browser API key. The browser endpoint is not a secret; do not add a private API key to a `VITE_*` variable.

## Developer workflow

For local development, install the requirements in a Python environment, place the two licensed ONNX models in `voices/`, start:

```bash
PORT=8765 python tools/piper-voice/server.py
```

Then run `npm run dev`. Vite proxies `/api` and `/health` to the local Python process. This developer-only setup is not required by app users.

## Hosting and license notes

The Render Blueprint requests a Free web service. Free instances may sleep while idle, and their memory limit may not be sufficient for both medium-sized voices. Verify container build, model loading, peak memory, and concurrent request behavior before release. Do not upgrade to a paid plan without explicit owner approval.

The English Kusal model card points to MycroftAI's Mimic2 dataset (Apache-2.0). The Arabic Kareem model card points to arabicttstrain but does not state that dataset's license; confirm its terms and speaker rights before commercial use. Review both model cards and attribution/redistribution requirements. The selected voices are not a custom-trained proprietary voice identity.
