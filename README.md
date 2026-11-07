# StickMotion AI

A free-first, browser-based 3D stickman animation studio. The product is being built as a real editing application: local-first projects, a 3D viewport, story-driven scene planning, an editable timeline, natural sound effects, and a dedicated render pipeline.

## Current development branch

The `development` branch is the active engineering branch. The active editor shell, procedural 3D character, canonical project model, offline storyboard planner, IndexedDB persistence layer, and CI workflow are now committed here.

### Shared core modules

- `src/core/model.ts` — versioned project, character, scene, transform, and sound data contracts.
- `src/core/storyboard.ts` — deterministic offline story-to-scene planner. This is explicitly rule-based, not a hosted AI model.
- `src/core/animation.ts` — pose keyframe creation and linear interpolation across character joints.
- `src/core/animation.test.ts` — unit tests for keyframe boundary and interpolation behavior.
- `src/core/playback.ts` — external animation clock so Three.js can read playback time without forcing a full React editor render on every frame.
- `src/core/storage.ts` — IndexedDB project repository with save, load, list, and delete operations.

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

GitHub Actions is configured to install dependencies, run TypeScript checks, and create a production build on pushes and pull requests. A successful run has not yet been confirmed. Local dependency installation and GitHub cloning were blocked by network/DNS restrictions in the current execution environment.

## Current limitations

The application is not yet a production release. The story planner is rule-based rather than generative AI. The character supports procedural motions and editable full-body pose keyframes for both arms, both legs, and the root transform; keyframe interpolation is currently linear. The timeline supports scene sequencing and continuous multi-scene playback, but easing curves, camera tracks, synchronized sound playback, and complete MP4 export are still under development. These limitations will be removed milestone by milestone and verified before release.

## Roadmap

1. Stabilize the project model and local persistence.
2. Integrate the canonical model into the editor and add project management.
3. Expand the procedural character rig and keyframe editor with per-joint controls, editable poses, and easing curves.
4. Expand multi-scene playback with camera controls, transitions, and a real timeline.
5. Add story planning with editable scene/action/camera suggestions.
6. Synchronize natural sound effects and subtitles.
7. Build complete sequence rendering and export.
8. Add automated tests, browser QA, performance checks, and release documentation.
