# StickMotion AI

A free-first, browser-based 3D stickman animation studio. The product is being built as a real editing application: local-first projects, a 3D viewport, story-driven scene planning, an editable timeline, natural sound effects, and a dedicated render pipeline.

## Current development branch

The `development` branch is the active engineering branch. The initial prototype exists locally, while the first shared core modules are now being added here.

### Shared core modules

- `src/core/model.ts` — versioned project, character, scene, transform, and sound data contracts.
- `src/core/storyboard.ts` — deterministic offline story-to-scene planner. This is explicitly rule-based, not a hosted AI model.
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

## Current limitations

The early prototype is not yet a production release. The story planner is rule-based; the existing character motions are procedural; the timeline is currently a scene sequencer rather than a full keyframe editor; and the prototype export is a viewport WebM preview, not a complete multi-scene render or MP4 export. These limitations will be removed milestone by milestone and verified before release.

## Roadmap

1. Stabilize the project model and local persistence.
2. Integrate the canonical model into the editor and add project management.
3. Build a rigged character and deterministic animation/keyframe system.
4. Implement multi-scene playback, camera controls, and a real timeline.
5. Add story planning with editable scene/action/camera suggestions.
6. Synchronize natural sound effects and subtitles.
7. Build complete sequence rendering and export.
8. Add automated tests, browser QA, performance checks, and release documentation.
