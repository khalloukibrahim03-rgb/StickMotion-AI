# Build the browser editor first; the user never downloads the TTS models.
FROM node:22-alpine AS frontend
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

# One same-origin service serves both the editor and cloud voice API.
FROM python:3.12-slim AS runtime
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=10000 \
    WEB_DIST_DIR=/app/dist \
    PIPER_EN_MODEL=/app/voices/en_US-kusal-medium.onnx \
    PIPER_AR_MODEL=/app/voices/ar_JO-kareem-medium.onnx
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY tools/piper-voice/server.py ./tools/piper-voice/server.py
COPY --from=frontend /app/dist ./dist
RUN mkdir -p /app/voices
WORKDIR /app/voices
# Download voice weights during the server image build, never on a visitor's device.
RUN python -m piper.download_voices --data-dir /app/voices en_US-kusal-medium ar_JO-kareem-medium
RUN useradd --create-home --uid 10001 app \
    && chown -R app:app /app
USER app
WORKDIR /app
EXPOSE 10000
CMD ["python", "tools/piper-voice/server.py"]
