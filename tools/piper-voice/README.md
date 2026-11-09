# Local Piper voice setup (Windows)

StickMotion AI can generate real scene narration WAV files through Piper running locally on your computer. The browser app does not download voice models automatically and does not send scripts to a cloud TTS provider.

## 1. Install Piper

Open PowerShell in the repository folder:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install piper-tts
```

If PowerShell blocks activation, use `.venv\Scripts\python.exe` instead of activating the environment.

## 2. Download voice models (optional, one-time)

Create a model folder and download one voice for each language you plan to use:

```powershell
New-Item -ItemType Directory -Force tools\piper-voice\voices
Set-Location tools\piper-voice\voices
python -m piper.download_voices en_US-ryan-medium
python -m piper.download_voices ar_JO-kareem-medium
Set-Location ..\..\..
```

The model files are large (roughly 60 MB each for these medium models). Download only the language you need. Voice models have their own model cards and licensing terms; review them before publishing commercial videos.

## 3. Start the local bridge

From the repository root, with the virtual environment active:

```powershell
python tools\piper-voice\server.py --english-model tools\piper-voice\voices\en_US-ryan-medium.onnx --arabic-model tools\piper-voice\voices\ar_JO-kareem-medium.onnx
```

You can provide only one model if you only need one language. The service listens on `127.0.0.1:8765` and is not exposed to your network.

By default, only local Vite origins `http://localhost:5173` and `http://127.0.0.1:5173` are allowed. If you run the app from another trusted origin, add it explicitly with `--origin https://your-app.example`. Do not add origins you do not control.

## 4. Generate a scene voice-over

1. Start StickMotion AI in the browser.
2. Open a scene and enter Arabic or English text in **Script / Narration Text** (or add subtitles).
3. In **StickMotion Pro Voice**, click **Generate scene voice-over with Piper**.
4. The generated WAV is saved locally to that scene, can be previewed, and is included in video export with the scene audio mix.
5. Repeat for each scene that needs narration.

## Privacy and limitations

- Text is sent only to the Piper process on your own computer; the bridge does not call a cloud API.
- Models are downloaded only when you run the download command.
- Piper currently offers a Jordanian Arabic model and multiple English models. The selected Arabic and English models may not sound like the exact same person.
- The browser pitch control affects only the browser voice preview. Piper speed is applied during WAV generation; pitch shifting is not yet supported by this bridge.
- This is a free local TTS workflow, but model quality and speed depend on the chosen voice and computer.
- The app intentionally adds no background music.
