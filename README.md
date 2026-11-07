# StickMotion AI

A free-first, browser-based 3D stickman animation studio. The product is being built as a real editing application: local-first projects, a 3D viewport, story-driven scene planning, an editable timeline, natural sound effects, and a dedicated render pipeline.

## Current development branch

The `development` branch is the active engineering branch. The active editor shell, procedural 3D character, canonical project model, offline storyboard planner, IndexedDB persistence layer, and CI workflow are now committed here.

### Shared core modules

- `src/core/model.ts` — versioned project, character, scene, transform, and sound data contracts.
- `src/core/storyboard.ts` — deterministic offline story-to-scene planner. This is explicitly rule-based, not a hosted AI model.
- `src/core/animation.ts` — pose keyframe creation, interpolation, and linear/ease-in/ease-out/ease-in-out curves.
- `src/core/animation.test.ts` — unit tests for keyframe boundaries, interpolation, and easing.
- `src/core/model.ts` — strict runtime validation for imported project files and their scenes, transforms, keyframes, and sound cues.
- `src/core/model.test.ts` — project import validation tests.
- `src/core/sound.ts` — local Web Audio synthesis and scene-local sound cue scheduling.
- `src/core/subtitles.ts` — SRT/WebVTT parsing and project-wide serialization with scene-duration offsets; captions crossing scene boundaries are split into scene-local cues.
- `src/core/subtitles.test.ts` — subtitle import/export tests covering timestamps, Arabic text, scene offsets, sorting, splitting, and empty projects.
- `src/core/sound.test.ts` — sound cue crossing, time-zero, chronological ordering, and backward-seek tests.
- `src/core/playback.ts` — external animation clock so Three.js can read playback time without forcing a full React editor render on every frame.
- `src/core/storage.ts` — IndexedDB project repository with save, load, list, and delete operations.
- Project transfer — import and export versioned `.stickmotion.json` files from the editor.
- Subtitle editing — edit caption text and scene-local start/end times, preview cues, import `.srt`/`.vtt` files into scenes, and export project-wide `.srt` or `.vtt` files.

## Product principles

- **Web-first and free-first:** avoid mandatory paid services for the core editing workflow.
- **Editable output:** generated scenes remain editable by the user.
- **Honest AI boundaries:** offline rules are not described as generative AI. Future AI providers must be optional and replaceable.
- **Natural sound only:** sound effects and ambience are supported; no background music or instrumental tracks are part of the product direction.
- **No fake controls:** a feature is not considered complete until its action works and has been tested.

## Planned application architecture

- `src/core` — canonical project model, story planning, persistence, commands, and validation.
- `src/engine` — Three.js character rig, animation playback, scene and camera systems.
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

GitHub Actions is configured to install dependencies, run TypeScript checks, and create a production build on pushes and pull requests. The last confirmed sound-cue timing workflow passed tests, type checking, and production build. The latest project import/export and validation changes are being checked by GitHub Actions. Local dependency installation and GitHub cloning were blocked by network/DNS restrictions in the current execution environment.

## Current limitations

The application is not yet a production release. The story planner is rule-based rather than generative AI. The character supports procedural motions and editable full-body pose keyframes for both arms, both legs, and the root transform, with linear and eased interpolation. Scene-local natural sound cues can be previewed, edited, and triggered during forward timeline playback. Projects can be saved locally and transferred as validated JSON files. Camera keyframe tracks, muxing subtitle/audio tracks into the final video, and complete MP4 export are still under development. These limitations will be removed milestone by milestone and verified before release.

## Roadmap

1. Stabilize the project model and local persistence.
2. Integrate the canonical model into the editor and add project management.
3. Expand the procedural character rig and keyframe editor with per-joint controls, editable poses, and easing curves.
4. Add camera presets and camera keyframe tracks to the scene timeline.
5. Expand story planning with editable scene/action/camera suggestions.
6. Improve natural sound effect scheduling and add subtitle tracks.
7. Build complete sequence rendering and MP4 export.
8. Add automated tests, browser QA, performance checks, and release documentation.


### Natural sound effects

- Each scene stores editable sound cues (effect, scene-local time, and volume) in the project data.
- The editor synthesizes short footstep, whoosh, landing, rain, and wind effects locally with the Web Audio API; no external audio service or sound assets are required.
- Cues fire when playback crosses their timestamp, including cues at the start of a scene. Backward seeking does not trigger effects.
- The product intentionally excludes background music, instrumental tracks, and music beds. Audio export/mixing is not yet implemented.
