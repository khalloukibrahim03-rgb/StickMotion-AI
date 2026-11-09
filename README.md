# StickMotion AI

A free-first, browser-based 3D animation and video-production studio. The goal is an end-to-end creator workflow: generate editable 3D scenes, edit the finished sequence with professional timeline tools, and export YouTube-ready videos—not merely generate a 3D preview.

## Current development branch

The `development` branch is the active engineering branch. The active editor shell, procedural 3D character, canonical project model, offline storyboard planner, IndexedDB persistence layer, and CI workflow are now committed here.

### Shared core modules

- `src/core/model.ts` — versioned project, character, scene, transform, and sound data contracts.
- `src/core/topic-script.ts` — short English or Arabic topic to a four-beat educational narration draft; deterministic offline templates, not generative AI.
- `src/core/storyboard.ts` — offline prompt-to-storyboard planner with English/Arabic action recognition, editable scene beats, cinematic camera framing/moves, and motion-matched natural sound cues. This is deterministic planning, not a hosted generative AI model.
- `src/core/render.ts` — deterministic 30 FPS render schedule for scene sequences.
- Browser export currently records the 3D viewport to WebM at 30 FPS (up to 90 seconds), composites timed subtitles into the frames, and mixes the project's synthesized natural sound cues when browser audio capture is available. MP4/H.264 encoding and a full offline frame renderer are still future work.
- `src/core/animation.ts` — pose keyframe creation, interpolation, and linear/ease-in/ease-out/ease-in-out curves.
- `src/core/animation.test.ts` — unit tests for keyframe boundaries, interpolation, and easing.
- `src/core/model.ts` — strict runtime validation for imported project files and their scenes, transforms, keyframes, and sound cues.
- `src/core/model.test.ts` — project import validation tests.
- `src/core/sound.ts` — local Web Audio synthesis and scene-local sound cue scheduling.
- Scene narration — editable per-scene narration text with browser SpeechSynthesis voice preview, automatic Arabic/English language detection, voice selection, and speaking-rate control. Imported per-scene voice-over recordings are decoded with Web Audio, previewable, and mixed into exported video at each scene start. Browser SpeechSynthesis remains an optional basic test voice only.
- `src/core/narration.ts` — creates editable, word-count-timed subtitle cues from scene narration in English or Arabic; timings are estimates and can be refined in the subtitle editor.
- `src/core/subtitles.ts` — SRT/WebVTT parsing and project-wide serialization with scene-duration offsets; captions crossing scene boundaries are split into scene-local cues.
- `src/core/subtitles.test.ts` — subtitle import/export tests covering timestamps, Arabic text, scene offsets, sorting, splitting, and empty projects.
- `src/core/sound.test.ts` — sound cue crossing, time-zero, chronological ordering, and backward-seek tests.
- `src/core/playback.ts` — external animation clock so Three.js can read playback time without forcing a full React editor render on every frame.
- `src/core/storage.ts` — IndexedDB project repository plus separately stored per-scene narration audio (up to 40 MB per recording).
- Project transfer — import and export versioned `.stickmotion.json` files from the editor.
- Subtitle editing — edit caption text and scene-local start/end times, preview cues, import `.srt`/`.vtt` files into scenes, and export project-wide `.srt` or `.vtt` files.

## YouTube-ready production target

StickMotion AI is intended to be a complete creator/editor, not only a 3D scene generator. The production workflow must cover:

1. **Create:** turn a prompt into editable 3D scenes, character motion, camera direction, and natural sound cues.
2. **Edit:** arrange and trim scenes on a timeline; refine keyframes and camera moves; add titles, captions, transitions, and imported media; control audio levels and timing.
3. **Publish:** choose YouTube formats (16:9 landscape, 9:16 Shorts, and 1:1 square), resolution and frame rate; render a reliable MP4/H.264 file with synchronized audio and captions; provide a clear export-quality check.
4. **Finish:** support reusable project files and a repeatable render workflow so creators can revise a video without rebuilding it.

These are product requirements, not claims that every capability is already implemented. Current editing tools include scene sequencing, character/camera keyframes, scene-local natural SFX, subtitle editing/import/export, and a browser-based 720p/30 FPS recording path. Multi-track media editing, transitions/title graphics, selectable YouTube export presets, dependable MP4/H.264 output, and complete audio muxing remain unfinished.

## Product principles

- **Web-first and free-first:** avoid mandatory paid services for the core editing workflow.
- **Editable output:** generated scenes remain editable by the user.
- **Honest AI boundaries:** offline rules are not described as generative AI. Future AI providers must be optional and replaceable.
- **Natural sound only:** sound effects and ambience are supported; no background music or instrumental tracks are part of the product direction.
- **No fake controls:** a feature is not considered complete until its action works and has been tested.

## Planned application architecture

- `src/core` — canonical project model, story planning, persistence, commands, and validation.
- `src/engine` — Three.js character rig, animation playback, scene and camera systems; `CameraAnimator` applies keyed camera position, target, and FOV to the live viewport.
- `src/media` — audio scheduling, subtitles, frame capture, and video rendering.
- `src/ui` — React editor, panels, timeline, and accessible controls.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Production checks:

```bash
npm run typecheck
npm run build
```

## Validation status

GitHub Actions is configured to install dependencies, run TypeScript checks, and create a production build on pushes and pull requests. The latest confirmed CI run on the previous commit passed unit tests, TypeScript, Python syntax validation, and production build. The cloud voice and deployment changes are now committed and their new workflow run must pass before release. Local dependency installation and GitHub cloning were blocked by network/DNS restrictions in the current execution environment.

## Current limitations

The application is not yet a production release. The prompt planner is rule-based rather than generative AI: it recognizes common English and Arabic action phrases, builds editable scene beats, suggests camera moves, and adds natural sound cues. The character supports procedural motions and editable full-body pose keyframes for both arms, both legs, and the root transform, with linear and eased interpolation. Scene-local natural sound cues can be previewed, edited, and triggered during forward timeline playback. Projects can be saved locally and transferred as validated JSON files. Camera keyframes now animate the live preview while playing; pause playback to orbit the camera manually and capture a new keyframe. Advanced multi-track editing and dependable MP4/H.264 export remain unfinished. Cloud voice generation is implemented in the app and backend, but it is not live until the Docker service has been deployed and its memory, Arabic/English output, and export path have passed end-to-end tests. These limitations will be removed milestone by milestone and verified before release.

## Roadmap

1. Stabilize the project model and local persistence.
2. Integrate the canonical model into the editor and add project management.
3. Expand the procedural character rig and keyframe editor with per-joint controls, editable poses, and easing curves.
4. Add camera presets and camera keyframe tracks to the scene timeline.
5. Expand story planning with editable scene/action/camera suggestions.
6. Improve natural sound effect scheduling and add subtitle tracks.
7. Build a real multi-track video editor with clip trimming, transitions, title/graphic overlays, and imported media.
8. Add YouTube publishing presets for landscape, Shorts, and square output, with selectable resolution/frame rate and validated MP4/H.264 plus synchronized audio.
9. Complete sequence rendering, export recovery/progress, and browser/device compatibility checks.
10. Add automated tests, browser QA, performance checks, and release documentation.


### Natural sound effects

- Each scene stores editable sound cues (effect, scene-local time, and volume) in the project data.
- The editor synthesizes short footstep, whoosh, landing, rain, and wind effects locally with the Web Audio API; no external audio service or sound assets are required.
- Cues fire when playback crosses their timestamp, including cues at the start of a scene. Backward seeking does not trigger effects.
- The product intentionally excludes background music, instrumental tracks, and music beds. Audio export/mixing is not yet implemented.


## YouTube export presets

The editor includes browser-based export profiles for common YouTube formats:

- **Standard video:** 1920 × 1080 (16:9).
- **YouTube Shorts:** 1080 × 1920 (9:16).
- **Square video:** 1080 × 1080 (1:1).

Exports support selectable 24, 30, or 60 FPS. The frame schedule, capture rate, and bitrate target follow the selected frame rate; higher frame rates increase render time and file size.

The renderer temporarily resizes the WebGL drawing buffer to the selected delivery dimensions and matching camera aspect ratio, then restores the editor viewport after export. This avoids stretching and preserves the requested output resolution. The bitrate target is selected per format. Timed subtitles are composited into the exported frames. Natural sound effects remain supported; the product does not add background music.

Exports are limited to 90 seconds in the current browser renderer. MP4/H.264 is selected only when the browser reports support; otherwise the file is exported as WebM. Actual codec availability and recording performance depend on the browser and device.


## Scene timeline editing

The scene sequence supports renaming, duration changes, moving scenes earlier or later, duplication, and deletion. Duplicating a scene regenerates IDs for its props, subtitles, sound cues, pose keyframes, and camera keyframes so the copy can be edited independently. Shortening a scene clamps or removes timed elements that would otherwise fall outside its new duration. Scene durations can be set from 0.5 to 120 seconds; the current browser video export still enforces its separate 90-second project limit.

Scene transitions include a configurable fade-in from black (off, 0.25, 0.5, 1, 2, or 3 seconds). The fade is previewed in the editor and composited into rendered video while captions remain readable.


## Subtitle styling for YouTube exports

Choose one of three caption looks in the subtitle inspector: **Classic** boxed captions, **Bold** larger captions, or **Minimal** outlined text. Captions can be positioned at the bottom or center of the frame. The selected style is applied both to the live preview and to burned-in export captions, with typography scaled to the chosen landscape, Shorts, or square output resolution. SRT/VTT sidecar exports remain plain timed text and are not affected by visual styling.

## Multi-track timeline (in progress)

The editor now displays scene segments with separate **Captions**, **SFX**, **Pose**, and **Camera** lanes. Subtitle blocks are sized from their timed ranges, sound cues and keyframes are placed at their scene-local timestamps, and selecting any cue pauses playback, selects its scene, and seeks the playhead to that cue. This is the first interactive multi-lane editing layer; drag-to-trim, drag-to-move, and imported media tracks remain planned work.

## Supporting visual media (development)

- The prompt-to-storyboard flow now searches Wikimedia Commons for scene-matched supporting media. It alternates image and video searches where possible and keeps the scene editable if no result is available.
- Creators can also search images or video clips manually, inspect the source page, license label, and available author/credit metadata, then attach the result to the active scene.
- Attached assets are stored with their source URL, media URL, license/credit metadata, and scene-local in/out times. They appear as scene cutaways in preview and are composited into the rendered export.
- This first media provider is free and requires no API key. A listed Commons license is not a blanket permission for every use: creators must open the source page and comply with the individual license and attribution requirements.
- This is media discovery and deterministic storyboard assembly, not generative AI video synthesis. Automatic script writing, voice narration, advanced cutaway editing, and more providers remain future milestones.


## StickMotion Cloud Voice

- The app sends scene narration to the same-origin `/api/tts` endpoint. The production Docker image serves the web editor and voice API together, so no API key or local address is exposed in the browser.
- Piper TTS is an open-source server-side engine. English (`en_US-ryan-medium`) and Jordanian Arabic (`ar_JO-kareem-medium`) model files are fetched during the server image build and stay on the server; visitors do not download Python, Piper, or model weights.
- The voice endpoint supports Arabic and English, documentary/energetic/calm synthesis profiles, speaking-rate control, bounded request size, a per-client request limit, and one synthesis at a time to protect a small free instance.
- Generated WAV files are stored per scene in browser IndexedDB, previewable, and included in the audio stream during video export when the browser grants audio capture.
- The browser SpeechSynthesis feature is only a device-dependent preview. It is not the StickMotion Cloud Voice and is not used as the final exported narration.
- Voice identity is currently based on the selected licensed Piper voice model plus synthesis settings. It is not a newly trained proprietary speaker identity; that requires consented voice recordings and a separate model-training milestone.
- Review each voice model's own license and model card before commercial publishing. The Piper engine license does not automatically grant rights to every voice model.
- No background music, instrumental tracks, or music beds are added.

## Cloud deployment

The repository includes a multi-stage `Dockerfile` and a Render Blueprint (`render.yaml`). The container builds the web editor, installs Piper, downloads the voice models server-side, and serves the app plus `/api/tts` from one origin.

For a no-cost prototype, create a Render Blueprint deployment from this repository and select the `development` branch. The blueprint requests Render's Free web-service plan; it does not create a paid instance. Important limitations: Render Free services can sleep when idle and take time to wake, and the 512 MB memory limit may be too small for both medium Piper models. The build and runtime memory must be measured before treating cloud voice as production-ready. If the free instance cannot load the models reliably, do not silently upgrade or incur charges; keep cloud voice marked unavailable until a genuinely free host with sufficient memory is available.

For local developer testing only, run the Python service with Piper models already present and start Vite. Vite proxies `/api` and `/health` to `127.0.0.1:8765`. This is a developer workflow, not an end-user setup requirement.

## Voice style controls

The editor provides Documentary, Energetic, and Calm presets. These set the starting rate and the synthesis style parameters sent to the hosted Piper service. The browser pitch slider applies only to the optional system-voice preview; Piper does not currently provide a pitch-shift control in this integration.

