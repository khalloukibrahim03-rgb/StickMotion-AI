import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { ContactShadows, Grid, OrbitControls } from "@react-three/drei";
import { ChevronRight, Download, Pause, Play, Plus, Save, Sparkles, Trash2, Upload, Volume2 } from "lucide-react";
import Stickman from "./engine/Stickman";
import CameraAnimator from "./engine/CameraAnimator";
import { buildStoryboard } from "./core/storyboard";
import { buildRenderSchedule, getRenderMimeType } from "./core/render";
import { createPoseKeyframe, evaluateCamera } from "./core/animation";
import type { EvaluatedPose } from "./core/animation";
import { createProject, createScene, isAnimationProject, type AnimationProject, type AnimationScene, type Motion } from "./core/model";
import { listProjects, saveProject as persistProject } from "./core/storage";
import { getPlaybackTime, setPlaybackTime } from "./core/playback";
import { beginAudioCapture, endAudioCapture, getCrossedSoundEvents, playNaturalSound, soundEffectLabels, unlockAudio } from "./core/sound";
import { distributeSubtitlesAcrossScenes, parseSubtitleFile, serializeSubtitles, type SubtitleFormat } from "./core/subtitles";
import type { CameraSettings, SceneSound, SubtitleCue } from "./core/model";

const motions: Motion[] = ["idle", "walk", "run", "jump", "wave"];

export default function App() {
  const [project, setProject] = useState<AnimationProject>(() => createProject());
  const importInput = useRef<HTMLInputElement>(null);
  const subtitleImportInput = useRef<HTMLInputElement>(null);
  const liveCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const orbitControlsRef = useRef<{ target: THREE.Vector3 } | null>(null);
  const [activeSceneId, setActiveSceneId] = useState(project.scenes[0].id);
  const [subtitleDraft, setSubtitleDraft] = useState("");
  const [story, setStory] = useState("A curious stickman walks into a quiet room. It notices a strange object and jumps in surprise. Then it waves hello.");
  const [playing, setPlaying] = useState(true);
  const [playhead, setPlayhead] = useState(0);
  const [keyframeTime, setKeyframeTime] = useState(0);
  const [keyframeEasing, setKeyframeEasing] = useState<"linear" | "ease-in" | "ease-out" | "ease-in-out">("linear");
  const [keyframeLeftArm, setKeyframeLeftArm] = useState(0);
  const [keyframeRightArm, setKeyframeRightArm] = useState(0);
  const [keyframeLeftLeg, setKeyframeLeftLeg] = useState(0);
  const [keyframeRightLeg, setKeyframeRightLeg] = useState(0);
  const [keyframeRootX, setKeyframeRootX] = useState(0);
  const [keyframeRootY, setKeyframeRootY] = useState(0);
  const [keyframeRootZ, setKeyframeRootZ] = useState(0);
  const [selectedKeyframeId, setSelectedKeyframeId] = useState<string | null>(null);
  const [soundEffect, setSoundEffect] = useState<SceneSound["effect"]>("footstep");
  const [soundVolume, setSoundVolume] = useState(0.7);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("Local workspace ready");
  const [recentProjects, setRecentProjects] = useState<AnimationProject[]>([]);
  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const renderCancelRef = useRef(false);

  const activeScene = project.scenes.find((scene) => scene.id === activeSceneId) ?? project.scenes[0];
  const cameraSettings = useMemo(() => evaluateCamera(activeScene?.cameraKeyframes ?? [], playhead, activeScene?.camera ?? { position: [4.8, 3.2, 6.2], target: [0, 1.1, 0], fov: 42 }), [activeScene, playhead]);
  const totalDuration = useMemo(
    () => project.scenes.reduce((total, scene) => total + scene.durationSeconds, 0),
    [project.scenes],
  );

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let previous = 0;
    let lastUiUpdate = 0;
    const tick = (now: number) => {
      if (previous) {
        const delta = (now - previous) / 1000;
        const duration = Math.max(0.1, activeScene?.durationSeconds ?? 4);
        const from = getPlaybackTime();
        const next = from + delta;
        for (const cue of getCrossedSoundEvents(activeScene?.sounds ?? [], from, Math.min(next, duration))) {
          playNaturalSound(cue.effect, cue.volume);
        }
        if (next >= duration) {
          const currentIndex = project.scenes.findIndex((scene) => scene.id === activeSceneId);
          const nextScene = project.scenes[(currentIndex + 1) % project.scenes.length];
          setPlaybackTime(0);
          setPlayhead(0);
          if (nextScene) setActiveSceneId(nextScene.id);
        } else {
          setPlaybackTime(next);
          // Keep the React editor responsive without re-rendering the whole UI at 60fps.
          if (now - lastUiUpdate >= 50) {
            setPlayhead(next);
            lastUiUpdate = now;
          }
        }
      }
      previous = now;
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [playing, activeSceneId, activeScene?.durationSeconds, project.scenes]);

  useEffect(() => {
    setPlayhead(0);
    setPlaybackTime(0);
    setSelectedKeyframeId(null);
    setKeyframeTime(0);
  }, [activeSceneId]);

  useEffect(() => {
    void listProjects().then(setRecentProjects).catch(() => setMessage("Local project storage is unavailable in this browser"));
  }, []);

  function updateProject(patch: Partial<AnimationProject>) {
    setProject((current) => ({ ...current, ...patch, updatedAt: new Date().toISOString() }));
    setSaved(false);
  }

  function updateScene(patch: Partial<AnimationScene>) {
    updateProject({
      scenes: project.scenes.map((scene) => scene.id === activeSceneId ? { ...scene, ...patch } : scene),
    });
  }


  function updateSubtitleCue(id: string, patch: Partial<SubtitleCue>) {
    if (!activeScene) return;
    updateScene({
      subtitles: (activeScene.subtitles ?? []).map((cue) => cue.id === id ? { ...cue, ...patch } : cue),
    });
  }

  async function importSubtitleFile(file?: File) {
    if (!file) return;
    try {
      const cues = parseSubtitleFile(await file.text());
      if (!cues.length) {
        setMessage("No valid SRT or WebVTT cues found in this file");
        return;
      }
      const result = distributeSubtitlesAcrossScenes(project.scenes, cues);
      if (!result.importedCount) {
        setMessage("No subtitle cues overlap this project's timeline");
        return;
      }
      updateProject({ scenes: result.scenes });
      setMessage("Imported " + result.importedCount + " scene subtitle cues" + (result.skippedCount ? " · skipped " + result.skippedCount + " outside the project" : ""));
    } catch {
      setMessage("Could not read this subtitle file");
    } finally {
      if (subtitleImportInput.current) subtitleImportInput.current.value = "";
    }
  }

  function exportSubtitleFile(format: SubtitleFormat) {
    const contents = serializeSubtitles(project.scenes, format);
    if (!contents.trim()) {
      setMessage("There are no subtitles to export yet");
      return;
    }
    const blob = new Blob([contents], { type: format === "vtt" ? "text/vtt;charset=utf-8" : "application/x-subrip;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const base = project.title.trim().replace(/[^a-z0-9-_]+/gi, "-") || "stickmotion";
    anchor.href = url;
    anchor.download = base + (format === "vtt" ? ".vtt" : ".srt");
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("Subtitles exported as " + format.toUpperCase());
  }

  function addCameraKeyframe() {
    if (!activeScene) return;
    const fallback: CameraSettings = activeScene.camera ?? {
      position: [4.8, 3.2, 6.2],
      target: [0, 1.1, 0],
      fov: 42,
    };
    const liveCamera = liveCameraRef.current;
    const liveTarget = orbitControlsRef.current?.target;
    const camera: CameraSettings = liveCamera ? {
      position: [liveCamera.position.x, liveCamera.position.y, liveCamera.position.z],
      target: liveTarget ? [liveTarget.x, liveTarget.y, liveTarget.z] : fallback.target,
      fov: liveCamera.fov,
    } : fallback;
    const frame = {
      id: "cam_" + Math.random().toString(36).slice(2, 10),
      atSeconds: Math.min(playhead, activeScene.durationSeconds),
      position: [...camera.position] as [number, number, number],
      target: [...camera.target] as [number, number, number],
      fov: camera.fov,
    };
    updateScene({
      camera,
      cameraKeyframes: [
        ...(activeScene.cameraKeyframes ?? []).filter((item) => Math.abs(item.atSeconds - frame.atSeconds) > 0.001),
        frame,
      ].sort((left, right) => left.atSeconds - right.atSeconds),
    });
    setMessage("Captured live camera view at " + frame.atSeconds.toFixed(2) + "s");
  }

  function addSubtitleCue() {
    const text = subtitleDraft.trim();
    if (!text || !activeScene) return;
    const startSeconds = Math.min(playhead, Math.max(0, activeScene.durationSeconds - 0.25));
    const endSeconds = Math.min(activeScene.durationSeconds, startSeconds + 2.5);
    updateScene({ subtitles: [...(activeScene.subtitles ?? []), { id: "sub_" + Math.random().toString(36).slice(2,10), text, startSeconds, endSeconds }] });
    setSubtitleDraft("");
    setMessage("Subtitle added to scene at " + startSeconds.toFixed(2) + "s");
  }

  function addScene() {
    const scene = createScene("Scene " + String(project.scenes.length + 1).padStart(2, "0"));
    updateProject({ scenes: [...project.scenes, scene] });
    setActiveSceneId(scene.id);
  }

  function generateStory() {
    const scenes = buildStoryboard(story);
    if (!scenes.length) {
      setMessage("Write a story first, then generate scenes");
      return;
    }
    updateProject({ scenes });
    setActiveSceneId(scenes[0].id);
    setMessage("Created " + scenes.length + " editable scenes using the offline story planner");
  }

  async function renderVideo() {
    if (rendering) return;
    const canvas = document.querySelector<HTMLCanvasElement>(".viewport canvas");
    const mimeType = getRenderMimeType();
    if (!canvas || typeof canvas.captureStream !== "function" || !mimeType) {
      setMessage("Video recording is not supported by this browser");
      return;
    }
    const schedule = buildRenderSchedule(project.scenes, 30);
    if (!schedule.length) {
      setMessage("Add at least one scene before rendering");
      return;
    }
    if (schedule.length > 30 * 90) {
      setMessage("This browser renderer is limited to 90 seconds per export");
      return;
    }

    const previousSceneId = activeSceneId;
    const previousTime = playhead;
    const wasPlaying = playing;
    const chunks: BlobPart[] = [];
    let stream: MediaStream | null = null;
    let recorder: MediaRecorder | null = null;
    const compositeCanvas = document.createElement("canvas");
    compositeCanvas.width = canvas.width;
    compositeCanvas.height = canvas.height;
    const compositeContext = compositeCanvas.getContext("2d");
    if (!compositeContext) {
      setMessage("Could not create the video compositing surface");
      return;
    }
    renderCancelRef.current = false;
    setRendering(true);
    setRenderProgress(0);
    setPlaying(false);
    try {
      const videoStream = compositeCanvas.captureStream(30);
      await unlockAudio();
      const audioStream = beginAudioCapture();
      stream = new MediaStream([...videoStream.getVideoTracks(), ...(audioStream?.getAudioTracks() ?? [])]);
      recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
      const stopped = new Promise<void>((resolve, reject) => {
        if (!recorder) return reject(new Error("Recorder could not start"));
        recorder.onerror = () => reject(new Error("Browser video recording failed"));
        recorder.onstop = () => resolve();
      });
      recorder.start(500);
      let renderedSceneId = "";
      let previousSceneTime = -1 / 30;
      for (let index = 0; index < schedule.length; index += 1) {
        if (renderCancelRef.current) break;
        const frame = schedule[index];
        const scene = project.scenes[frame.sceneIndex];
        if (scene.id !== renderedSceneId) {
          setActiveSceneId(scene.id);
          renderedSceneId = scene.id;
          previousSceneTime = -1 / 30;
        }
        for (const cue of getCrossedSoundEvents(scene.sounds ?? [], previousSceneTime, frame.sceneTime)) playNaturalSound(cue.effect, cue.volume);
        previousSceneTime = frame.sceneTime;
        setPlaybackTime(frame.sceneTime);
        setPlayhead(frame.sceneTime);
        // Give React Three Fiber a paint opportunity before capturing the next frame.
        await new Promise<void>((resolve) => window.setTimeout(resolve, 1000 / 30));
        compositeContext.clearRect(0, 0, compositeCanvas.width, compositeCanvas.height);
        compositeContext.drawImage(canvas, 0, 0, compositeCanvas.width, compositeCanvas.height);
        const activeCues = (scene.subtitles ?? []).filter((cue) => frame.sceneTime >= cue.startSeconds && frame.sceneTime < cue.endSeconds);
        if (activeCues.length) {
          const width = compositeCanvas.width;
          const height = compositeCanvas.height;
          const fontSize = Math.max(18, Math.round(width * 0.027));
          compositeContext.font = "600 " + fontSize + "px Arial, sans-serif";
          compositeContext.textAlign = "center";
          compositeContext.textBaseline = "middle";
          for (const cue of activeCues) {
            const words = cue.text.split(/\\s+/);
            const lines: string[] = [];
            let line = "";
            for (const word of words) {
              const candidate = line ? line + " " + word : word;
              if (line && compositeContext.measureText(candidate).width > width * 0.82) {
                lines.push(line);
                line = word;
              } else line = candidate;
            }
            if (line) lines.push(line);
            const lineHeight = fontSize * 1.35;
            const blockHeight = lines.length * lineHeight + fontSize * 0.8;
            const centerY = height - blockHeight * 0.72;
            const maxLineWidth = Math.max(...lines.map((item) => compositeContext.measureText(item).width));
            const boxWidth = Math.min(width * 0.9, maxLineWidth + fontSize * 1.8);
            compositeContext.fillStyle = "rgba(8, 11, 20, 0.84)";
            compositeContext.beginPath();
            compositeContext.roundRect((width - boxWidth) / 2, centerY - blockHeight / 2, boxWidth, blockHeight, fontSize * 0.35);
            compositeContext.fill();
            compositeContext.fillStyle = "#ffffff";
            compositeContext.direction = /[\\u0600-\\u06FF]/.test(cue.text) ? "rtl" : "ltr";
            lines.forEach((item, lineIndex) => compositeContext.fillText(item, width / 2, centerY - ((lines.length - 1) * lineHeight) / 2 + lineIndex * lineHeight, width * 0.84));
          }
        }
        if (index % 5 === 0 || index === schedule.length - 1) {
          setRenderProgress(Math.round(((index + 1) / schedule.length) * 100));
        }
      }
      recorder.stop();
      await stopped;
      if (!renderCancelRef.current && chunks.length) {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        const safeTitle = project.title.trim().replace(/[^a-z0-9-_]+/gi, "-") || "stickmotion-video";
        anchor.href = url;
        anchor.download = safeTitle + ".webm";
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 30000);
        setMessage("Video render exported as WebM · 30 FPS · silent viewport capture");
      } else {
        setMessage("Video render cancelled");
      }
    } catch (error) {
      if (recorder && recorder.state !== "inactive") recorder.stop();
      setMessage(error instanceof Error ? error.message : "Video render failed");
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
      endAudioCapture();
      setActiveSceneId(previousSceneId);
      setPlaybackTime(previousTime);
      setPlayhead(previousTime);
      setPlaying(wasPlaying);
      setRendering(false);
    }
  }

  function cancelRender() {
    renderCancelRef.current = true;
  }

  async function save() {
    try {
      await persistProject(project);
      setSaved(true);
      setMessage("Project saved in this browser");
      setRecentProjects(await listProjects());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save project");
    }
  }

  function exportProject() {
    const contents = JSON.stringify(project, null, 2);
    const blob = new Blob([contents], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const safeTitle = project.title.trim().replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "") || "stickmotion-project";
    anchor.href = url;
    anchor.download = safeTitle + ".stickmotion.json";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("Project JSON exported");
  }

  async function importProject(file?: File) {
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isAnimationProject(parsed)) {
        setMessage("Invalid project file or unsupported schema version");
        return;
      }
      setProject(parsed);
      setActiveSceneId(parsed.scenes[0].id);
      setPlaying(false);
      setPlayhead(0);
      setPlaybackTime(0);
      setSaved(false);
      setMessage("Imported " + parsed.title + " — save it to your local projects");
    } catch {
      setMessage("Could not read this project file. Choose a valid StickMotion JSON export.");
    } finally {
      if (importInput.current) importInput.current.value = "";
    }
  }

  async function openProject(id: string) {
    const found = recentProjects.find((item) => item.id === id);
    if (!found) return;
    setProject(found);
    setActiveSceneId(found.scenes[0]?.id ?? "");
    setSaved(true);
    setMessage("Opened " + found.title);
  }

  function currentPose(): EvaluatedPose {
    const radians = (degrees: number) => degrees * Math.PI / 180;
    return {
      rootPosition: [keyframeRootX, keyframeRootY, keyframeRootZ],
      leftArmRotation: [0, 0, radians(keyframeLeftArm)],
      rightArmRotation: [0, 0, radians(keyframeRightArm)],
      leftLegRotation: [radians(keyframeLeftLeg), 0, 0],
      rightLegRotation: [radians(keyframeRightLeg), 0, 0],
    };
  }

  function addKeyframe() {
    if (!activeScene) return;
    const frame = createPoseKeyframe(keyframeTime, currentPose());
    frame.easing = keyframeEasing;
    const frames = [...(activeScene.keyframes ?? []).filter((item) => Math.abs(item.atSeconds - keyframeTime) > 0.001), frame].sort((a, b) => a.atSeconds - b.atSeconds);
    updateScene({ keyframes: frames });
    setSelectedKeyframeId(frame.id);
    setPlayhead(keyframeTime);
    setPlaybackTime(keyframeTime);
    setMessage("Keyframe added at " + keyframeTime.toFixed(1) + "s");
  }

  function updateKeyframe() {
    if (!activeScene || !selectedKeyframeId) return;
    const frames = (activeScene.keyframes ?? []).filter((frame) => frame.id !== selectedKeyframeId && Math.abs(frame.atSeconds - keyframeTime) > 0.001);
    const updated = createPoseKeyframe(keyframeTime, currentPose());
    updated.id = selectedKeyframeId;
    updated.easing = keyframeEasing;
    updateScene({ keyframes: [...frames, updated].sort((a, b) => a.atSeconds - b.atSeconds) });
    setPlayhead(keyframeTime);
    setPlaybackTime(keyframeTime);
    setMessage("Selected keyframe updated");
  }

  function selectKeyframe(frame: NonNullable<AnimationScene["keyframes"]>[number]) {
    const degrees = (radians: number) => Math.round(radians * 180 / Math.PI);
    setSelectedKeyframeId(frame.id);
    setKeyframeEasing(frame.easing ?? "linear");
    setKeyframeTime(frame.atSeconds);
    setPlayhead(frame.atSeconds);
    setPlaybackTime(frame.atSeconds);
    setKeyframeLeftArm(degrees(frame.leftArmRotation[2]));
    setKeyframeRightArm(degrees(frame.rightArmRotation[2]));
    setKeyframeLeftLeg(degrees(frame.leftLegRotation[0]));
    setKeyframeRightLeg(degrees(frame.rightLegRotation[0]));
    setKeyframeRootX(frame.rootPosition[0]);
    setKeyframeRootY(frame.rootPosition[1]);
    setKeyframeRootZ(frame.rootPosition[2]);
  }

  async function previewSound() {
    const unlocked = await unlockAudio();
    if (unlocked) playNaturalSound(soundEffect, soundVolume);
    else setMessage("This browser does not support Web Audio playback");
  }

  function addSoundCue() {
    if (!activeScene) return;
    const cue: SceneSound = { id: "sound_" + Math.random().toString(36).slice(2, 10), effect: soundEffect, atSeconds: Math.min(keyframeTime, activeScene.durationSeconds), volume: soundVolume };
    updateScene({ sounds: [...(activeScene.sounds ?? []), cue].sort((a, b) => a.atSeconds - b.atSeconds) });
    setMessage(soundEffectLabels[cue.effect] + " cue added at " + cue.atSeconds.toFixed(1) + "s");
  }

  function updateSoundCueTime(id: string, atSeconds: number) {
    if (!activeScene) return;
    const time = Math.max(0, Math.min(atSeconds, activeScene.durationSeconds));
    updateScene({
      sounds: (activeScene.sounds ?? [])
        .map((cue) => cue.id === id ? { ...cue, atSeconds: time } : cue)
        .sort((a, b) => a.atSeconds - b.atSeconds),
    });
  }

  function removeSoundCue(id: string) {
    if (!activeScene) return;
    updateScene({ sounds: (activeScene.sounds ?? []).filter((cue) => cue.id !== id) });
    setMessage("Sound cue removed");
  }

  function removeKeyframe() {
    if (!activeScene || !selectedKeyframeId) return;
    const remaining = (activeScene.keyframes ?? []).filter((frame) => frame.id !== selectedKeyframeId);
    updateScene({ keyframes: remaining });
    if (remaining[0]) selectKeyframe(remaining[0]);
    else setSelectedKeyframeId(null);
    setMessage("Keyframe deleted");
  }

  function removeScene() {
    if (project.scenes.length <= 1) {
      setMessage("A project must contain at least one scene");
      return;
    }
    const next = project.scenes.filter((scene) => scene.id !== activeSceneId);
    updateProject({ scenes: next });
    setActiveSceneId(next[0].id);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-icon">S</div><div><strong>StickMotion <span>AI</span></strong><small>3D CREATIVE STUDIO</small></div></div>
        <button className="new-project" onClick={() => { const next = createProject(); setProject(next); setActiveSceneId(next.scenes[0].id); setSaved(false); }}>
          <Plus size={16} /> New project
        </button>
        <div className="side-label">WORKSPACE</div>
        <div className="side-link active">◈ <span>Animation studio</span></div>
        <div className="side-label recent-label">YOUR PROJECTS</div>
        <div className="project-list">
          {recentProjects.length === 0 && <p className="empty-projects">Saved projects will appear here.</p>}
          {recentProjects.map((item) => <button key={item.id} className="project-link" onClick={() => void openProject(item.id)}>{item.title}</button>)}
        </div>
        <div className="sidebar-bottom"><div className="free-note"><Sparkles size={15}/><strong>Free-first workspace</strong><p>Your work is stored locally. No paid AI service is required for the core editor.</p></div><small>STICKMOTION AI · EARLY ACCESS</small></div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="crumbs">Workspace <ChevronRight size={14}/> <strong>Animation studio</strong><span className={saved ? "save-state" : "save-state unsaved"}>{saved ? "Saved" : "Unsaved"}</span></div>
          <div className="top-actions"><button className="save-button render-button" disabled={rendering} onClick={() => void renderVideo()}><Download size={14}/>{rendering ? "Rendering " + renderProgress + "%" : "Render video"}</button>{rendering && <button className="save-button cancel-render-button" onClick={cancelRender}>Cancel</button>}<input ref={importInput} className="file-input-hidden" type="file" accept=".json,application/json" aria-label="Import StickMotion project" onChange={(event) => void importProject(event.target.files?.[0])}/><button className="save-button transfer-button" onClick={() => importInput.current?.click()}><Upload size={14}/> Import JSON</button><button className="save-button transfer-button" onClick={exportProject}><Download size={14}/> Export JSON</button><button className="save-button" onClick={() => void save()}><Save size={15}/> Save project</button></div>
        </header>

        <section className="workspace">
          <div className="center-column">
            <div className="section-title"><div><h1>{project.title}</h1><p>Build scenes, direct your character, and shape your animation.</p></div><input aria-label="Project title" value={project.title} onChange={(event) => updateProject({ title: event.target.value })}/></div>
            <div className="viewport-card">
              <div className="viewport-top"><span>3D VIEWPORT <i/> LIVE PREVIEW</span><span>Perspective · Orbit to inspect</span></div>
              <div className="viewport">
                <Canvas shadows camera={{ position: cameraSettings.position, fov: cameraSettings.fov }} onCreated={({ camera }) => { if (camera instanceof THREE.PerspectiveCamera) liveCameraRef.current = camera; }}>
                  <color attach="background" args={["#111522"]}/>
                  <ambientLight intensity={0.75}/>
                  <directionalLight position={[4, 8, 5]} intensity={2.1} castShadow shadow-mapSize={[1024, 1024]}/>
                  <Grid position={[0, -0.03, 0]} args={[18, 18]} cellSize={0.5} cellColor="#343b52" sectionColor="#59627d" fadeDistance={20} infiniteGrid/>
                  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]} receiveShadow><planeGeometry args={[100, 100]}/><meshStandardMaterial color="#171c2b" roughness={0.95}/></mesh>
                  <Stickman color={project.character.primaryColor} motion={activeScene?.motion ?? "idle"} playing={playing} keyframes={activeScene?.keyframes ?? []}/>
                  <ContactShadows position={[0, -0.045, 0]} opacity={0.38} scale={5} blur={2.4} far={2}/>
                  <CameraAnimator settings={cameraSettings} animate={playing && Boolean(activeScene?.cameraKeyframes?.length)} sceneId={activeSceneId}/><OrbitControls ref={(controls) => { orbitControlsRef.current = controls as unknown as { target: THREE.Vector3 } | null; }} enabled={!(playing && Boolean(activeScene?.cameraKeyframes?.length))} target={cameraSettings.target} minDistance={3} maxDistance={12} maxPolarAngle={Math.PI / 2.02}/>
                </Canvas>
                <div className="viewport-caption">{activeScene?.name ?? "No scene"} · {(activeScene?.motion ?? "idle").toUpperCase()}</div>{(activeScene?.subtitles ?? []).filter((cue) => playhead >= cue.startSeconds && playhead < cue.endSeconds).map((cue) => <div className="subtitle-preview" key={cue.id}>{cue.text}</div>)}
              </div>
              <div className="viewport-controls"><div>SCENE {String(Math.max(1, project.scenes.findIndex((scene) => scene.id === activeSceneId) + 1)).padStart(2, "0")} / {String(project.scenes.length).padStart(2, "0")}</div><button className="play-button" onClick={() => { if (!playing) void unlockAudio(); setPlaying((value) => !value); }}>{playing ? <Pause size={16}/> : <Play size={16}/>} {playing ? "Pause" : "Play"}</button><div>{playhead.toFixed(1)}s / {activeScene?.durationSeconds ?? 4}s · {totalDuration}s total</div></div>
            </div>

            <div className="timeline-card">
              <div className="timeline-heading"><div><h2>Timeline</h2><small>SCENE SEQUENCE</small></div><button className="add-button" onClick={addScene}><Plus size={14}/> Add scene</button></div>
              <div className="timeline-track">
                {project.scenes.map((scene, index) => <button key={scene.id} className={scene.id === activeSceneId ? "scene-card selected" : "scene-card"} style={{ flex: Math.max(1, scene.durationSeconds) }} onClick={() => setActiveSceneId(scene.id)}><small>{String(index + 1).padStart(2, "0")} · {scene.durationSeconds}s</small><strong>{scene.name}</strong><span>{scene.motion}</span></button>)}
              </div>
              <div className="keyframe-tools"><div><label className="field-label">KEYFRAME TIME <b>{keyframeTime.toFixed(1)}s</b></label><input aria-label="Keyframe time" className="duration-range" type="range" min="0" max={Math.max(0.1, activeScene?.durationSeconds ?? 4)} step="0.1" value={Math.min(keyframeTime, activeScene?.durationSeconds ?? 4)} onChange={(event) => setKeyframeTime(Number(event.target.value))}/></div><div className="keyframe-easing"><label className="field-label">INTERPOLATION CURVE</label><select className="text-input" aria-label="Keyframe interpolation curve" value={keyframeEasing} onChange={(event) => setKeyframeEasing(event.target.value as "linear" | "ease-in" | "ease-out" | "ease-in-out")}><option value="linear">Linear</option><option value="ease-in">Ease in</option><option value="ease-out">Ease out</option><option value="ease-in-out">Ease in &amp; out</option></select><small>Controls the motion from this keyframe to the next.</small></div><div className="keyframe-pose">
                  <label className="field-label">LEFT ARM <b>{keyframeLeftArm}°</b></label><input aria-label="Left arm rotation" className="duration-range" type="range" min="-150" max="150" step="5" value={keyframeLeftArm} onChange={(event) => setKeyframeLeftArm(Number(event.target.value))}/>
                  <label className="field-label">RIGHT ARM <b>{keyframeRightArm}°</b></label><input aria-label="Right arm rotation" className="duration-range" type="range" min="-150" max="150" step="5" value={keyframeRightArm} onChange={(event) => setKeyframeRightArm(Number(event.target.value))}/>
                  <label className="field-label">LEFT LEG <b>{keyframeLeftLeg}°</b></label><input aria-label="Left leg rotation" className="duration-range" type="range" min="-90" max="90" step="5" value={keyframeLeftLeg} onChange={(event) => setKeyframeLeftLeg(Number(event.target.value))}/>
                  <label className="field-label">RIGHT LEG <b>{keyframeRightLeg}°</b></label><input aria-label="Right leg rotation" className="duration-range" type="range" min="-90" max="90" step="5" value={keyframeRightLeg} onChange={(event) => setKeyframeRightLeg(Number(event.target.value))}/>
                  <label className="field-label">ROOT X <b>{keyframeRootX.toFixed(1)}</b></label><input aria-label="Root X position" className="duration-range" type="range" min="-2" max="2" step="0.1" value={keyframeRootX} onChange={(event) => setKeyframeRootX(Number(event.target.value))}/>
                  <label className="field-label">ROOT Y <b>{keyframeRootY.toFixed(1)}</b></label><input aria-label="Root Y position" className="duration-range" type="range" min="0" max="2" step="0.1" value={keyframeRootY} onChange={(event) => setKeyframeRootY(Number(event.target.value))}/>
                  <label className="field-label">ROOT Z <b>{keyframeRootZ.toFixed(1)}</b></label><input aria-label="Root Z position" className="duration-range" type="range" min="-2" max="2" step="0.1" value={keyframeRootZ} onChange={(event) => setKeyframeRootZ(Number(event.target.value))}/>
                </div><div className="keyframe-actions"><button className="add-button" onClick={addKeyframe}><Plus size={14}/> Add</button><button className="add-button" onClick={updateKeyframe} disabled={!selectedKeyframeId}>Update</button><button className="delete-keyframe" onClick={removeKeyframe} disabled={!selectedKeyframeId}><Trash2 size={13}/> Delete</button></div><span>{activeScene?.keyframes?.length ?? 0} keyframes</span></div><div className="keyframe-list">{(activeScene?.keyframes ?? []).map((frame, index) => <button key={frame.id} className={selectedKeyframeId === frame.id ? "keyframe-chip selected" : "keyframe-chip"} onClick={() => selectKeyframe(frame)}>{String(index + 1).padStart(2, "0")} · {frame.atSeconds.toFixed(1)}s</button>)}</div><div className="playhead-control"><label className="field-label">PLAYHEAD <b>{playhead.toFixed(1)}s</b></label><input aria-label="Timeline playhead" className="duration-range" type="range" min="0" max={activeScene?.durationSeconds ?? 4} step="0.05" value={Math.min(playhead, activeScene?.durationSeconds ?? 4)} onChange={(event) => { setPlaying(false); setPlayhead(Number(event.target.value)); setPlaybackTime(Number(event.target.value)); }}/><div className="timeline-foot"><span>{project.scenes.length} scenes</span><span>Natural sound effects only · {totalDuration} seconds</span></div></div>
            </div>
          </div>

          <aside className="inspector">
            <div className="inspector-heading"><h2>Inspector</h2><span>EDIT</span></div>
            <section className="inspector-section"><h3>Character</h3><label className="field-label">PRIMARY COLOR</label><div className="color-row"><input type="color" value={project.character.primaryColor} onChange={(event) => updateProject({ character: { ...project.character, primaryColor: event.target.value } })}/><span>{project.character.primaryColor.toUpperCase()}</span></div></section>
            <section className="inspector-section"><div className="section-heading"><h3>Scene properties</h3><button className="icon-action" aria-label="Delete scene" onClick={removeScene}><Trash2 size={15}/></button></div>
              <label className="field-label">SCENE NAME</label><input className="text-input" value={activeScene?.name ?? ""} onChange={(event) => updateScene({ name: event.target.value })}/>
              <label className="field-label">MOTION</label><div className="motion-options">{motions.map((motion) => <button key={motion} className={activeScene?.motion === motion ? "motion-option chosen" : "motion-option"} onClick={() => updateScene({ motion })}>{motion}</button>)}</div>
              <label className="field-label duration-label">DURATION <b>{activeScene?.durationSeconds ?? 4}s</b></label><input className="duration-range" type="range" min="1" max="12" value={activeScene?.durationSeconds ?? 4} onChange={(event) => updateScene({ durationSeconds: Number(event.target.value) })}/>
              <label className="field-label">DESCRIPTION</label><textarea className="description-input" rows={3} value={activeScene?.description ?? ""} onChange={(event) => updateScene({ description: event.target.value })}/>
              <div className="camera-controls"><div className="section-heading"><h3>Camera framing</h3><button className="icon-action" aria-label="Reset camera framing" onClick={() => updateScene({ camera: { position: [4.8, 3.2, 6.2], target: [0, 1.1, 0], fov: 42 } })}>Reset</button></div>
                <label className="field-label">CAMERA DISTANCE <b>{Math.hypot(...(activeScene?.camera?.position ?? [4.8,3.2,6.2])).toFixed(1)}</b></label>
                <input aria-label="Camera distance" className="duration-range" type="range" min="3" max="12" step="0.2" value={Math.min(12, Math.max(3, Math.hypot(...(activeScene?.camera?.position ?? [4.8,3.2,6.2]))))} onChange={(event) => { const camera = activeScene?.camera ?? {position:[4.8,3.2,6.2] as [number,number,number],target:[0,1.1,0] as [number,number,number],fov:42}; const d = Math.hypot(...camera.position) || 1; const scale = Number(event.target.value)/d; updateScene({camera:{...camera,position:camera.position.map(v=>v*scale) as [number,number,number]}}); }}/>
                <label className="field-label">VERTICAL ANGLE <b>{(activeScene?.camera?.position[1] ?? 3.2).toFixed(1)}</b></label><input aria-label="Camera vertical angle" className="duration-range" type="range" min="1" max="8" step="0.2" value={activeScene?.camera?.position[1] ?? 3.2} onChange={(event) => { const camera = activeScene?.camera ?? {position:[4.8,3.2,6.2] as [number,number,number],target:[0,1.1,0] as [number,number,number],fov:42}; updateScene({camera:{...camera,position:[camera.position[0],Number(event.target.value),camera.position[2]]}}); }}/>
                <label className="field-label">FIELD OF VIEW <b>{activeScene?.camera?.fov ?? 42}°</b></label><input aria-label="Camera field of view" className="duration-range" type="range" min="25" max="75" step="1" value={activeScene?.camera?.fov ?? 42} onChange={(event) => updateScene({camera:{...(activeScene?.camera ?? {position:[4.8,3.2,6.2],target:[0,1.1,0],fov:42}),fov:Number(event.target.value)}})}/>
                <div className="camera-keyframes"><div className="section-heading"><span className="field-label">CAMERA KEYFRAMES · {activeScene?.cameraKeyframes?.length ?? 0}</span><button className="add-button" onClick={addCameraKeyframe}><Plus size={12}/> Capture view at playhead</button></div><div className="camera-keyframe-list">{(activeScene?.cameraKeyframes ?? []).map((frame) => <div className="camera-keyframe-row" key={frame.id}><button className="keyframe-chip" onClick={() => { setPlaying(false); setPlayhead(frame.atSeconds); setPlaybackTime(frame.atSeconds); }}>{frame.atSeconds.toFixed(2)}s</button><button className="icon-action" aria-label="Delete camera keyframe" onClick={() => updateScene({cameraKeyframes:(activeScene?.cameraKeyframes ?? []).filter((item)=>item.id!==frame.id)})}><Trash2 size={12}/></button></div>)}{!(activeScene?.cameraKeyframes?.length) && <small className="empty-projects">Move the playhead, adjust camera framing, then add a camera keyframe.</small>}</div></div>
              </div>
            </section>
            <section className="inspector-section sound-section"><div className="section-heading"><h3><Volume2 size={15}/> Natural sound effects</h3><span className="beta-tag">SFX</span></div><p>Place short sound cues on this scene. Audio is synthesized locally; no music is included.</p><label className="field-label">EFFECT</label><select className="text-input" value={soundEffect} onChange={(event) => setSoundEffect(event.target.value as SceneSound["effect"])}>{(Object.keys(soundEffectLabels) as SceneSound["effect"][]).map((effect) => <option key={effect} value={effect}>{soundEffectLabels[effect]}</option>)}</select><label className="field-label">VOLUME <b>{Math.round(soundVolume * 100)}%</b></label><input aria-label="Sound effect volume" className="duration-range" type="range" min="0" max="1" step="0.05" value={soundVolume} onChange={(event) => setSoundVolume(Number(event.target.value))}/><div className="sound-actions"><button className="add-button" onClick={() => void previewSound()}><Play size={13}/> Preview</button><button className="generate-button" onClick={addSoundCue}><Plus size={14}/> Add cue at {keyframeTime.toFixed(1)}s</button></div><div className="sound-cue-list">{(activeScene?.sounds ?? []).map((cue) => <div className="sound-cue" key={cue.id}><span><strong>{soundEffectLabels[cue.effect]}</strong><small>{cue.atSeconds.toFixed(1)}s · {Math.round(cue.volume * 100)}%</small><input aria-label={"Move " + soundEffectLabels[cue.effect] + " cue time"} className="duration-range cue-time-range" type="range" min="0" max={activeScene?.durationSeconds ?? 4} step="0.05" value={Math.min(cue.atSeconds, activeScene?.durationSeconds ?? 4)} onChange={(event) => updateSoundCueTime(cue.id, Number(event.target.value))}/></span><button className="icon-action" aria-label={"Delete " + soundEffectLabels[cue.effect]} onClick={() => removeSoundCue(cue.id)}><Trash2 size={14}/></button></div>)}{(activeScene?.sounds ?? []).length === 0 && <small className="empty-projects">No sound cues in this scene yet.</small>}</div></section>
            <section className="inspector-section subtitle-section"><div className="section-heading"><h3>Subtitles</h3><span className="beta-tag">LOCAL</span></div><p>Add timed captions in Arabic or English. Preview them at the current playhead.</p><textarea className="description-input" rows={2} maxLength={500} value={subtitleDraft} onChange={(event) => setSubtitleDraft(event.target.value)} placeholder="Type a caption / اكتب الترجمة هنا..."/><button className="generate-button" disabled={!subtitleDraft.trim()} onClick={addSubtitleCue}><Plus size={14}/> Add subtitle at {playhead.toFixed(1)}s</button><div className="subtitle-cue-list">{(activeScene?.subtitles ?? []).map((cue) => <div className="subtitle-cue subtitle-cue-edit" key={cue.id}>
                <div className="subtitle-cue-heading"><span>{cue.startSeconds.toFixed(2)}–{cue.endSeconds.toFixed(2)}s</span><button className="icon-action" aria-label="Delete subtitle" onClick={() => updateScene({subtitles:(activeScene?.subtitles ?? []).filter((item)=>item.id!==cue.id)})}><Trash2 size={13}/></button></div>
                <input className="subtitle-text-input" aria-label="Edit subtitle text" maxLength={500} value={cue.text} onChange={(event) => updateSubtitleCue(cue.id, { text: event.target.value })}/>
                <label className="field-label">START <b>{cue.startSeconds.toFixed(2)}s</b></label>
                <input aria-label="Subtitle start time" className="duration-range" type="range" min="0" max={Math.max(0, cue.endSeconds - 0.1)} step="0.05" value={cue.startSeconds} onChange={(event) => updateSubtitleCue(cue.id, { startSeconds: Number(event.target.value) })}/>
                <label className="field-label">END <b>{cue.endSeconds.toFixed(2)}s</b></label>
                <input aria-label="Subtitle end time" className="duration-range" type="range" min={Math.min(activeScene?.durationSeconds ?? 4, cue.startSeconds + 0.1)} max={activeScene?.durationSeconds ?? 4} step="0.05" value={cue.endSeconds} onChange={(event) => updateSubtitleCue(cue.id, { endSeconds: Number(event.target.value) })}/>
                <button className="cue-time" onClick={() => { setPlaying(false); setPlayhead(cue.startSeconds); setPlaybackTime(cue.startSeconds); }}>Preview from start</button>
              </div>)}{!(activeScene?.subtitles?.length) && <small className="empty-projects">No subtitles in this scene yet.</small>}</div>
              <div className="subtitle-export-actions"><input ref={subtitleImportInput} className="file-input-hidden" type="file" accept=".srt,.vtt,text/vtt,application/x-subrip" aria-label="Import SRT or WebVTT subtitles" onChange={(event) => void importSubtitleFile(event.target.files?.[0])}/><button className="sound-add" onClick={() => subtitleImportInput.current?.click()}><Upload size={12}/> Import SRT/VTT</button><button className="sound-add" onClick={() => exportSubtitleFile("srt")}><Download size={12}/> Export SRT</button><button className="sound-add" onClick={() => exportSubtitleFile("vtt")}><Download size={12}/> Export VTT</button></div></section>
            <section className="inspector-section story-section"><div className="section-heading"><h3>Prompt to video</h3><span className="beta-tag">STORYBOARD BETA</span></div><p>Describe the action, mood, camera shot, and setting. Build an editable scene plan with suggested motion, camera moves, and natural sound cues. MP4 rendering is not connected yet.</p><textarea className="story-input" rows={6} value={story} onChange={(event) => setStory(event.target.value)} placeholder="Example: A curious stickman walks through a rainy neon street, notices a glowing object, jumps back in surprise, then waves to the camera. Wide opening shot, then a close-up..."/><button className="generate-button" onClick={generateStory}><Sparkles size={15}/> Build video storyboard</button></section>
            <div className="inspector-status"><i/> {message}</div>
          </aside>
        </section>
        <footer className="app-footer"><span>STICKMOTION AI · 0.2 DEVELOPMENT</span><span>NO BACKGROUND MUSIC · NATURAL SFX DIRECTION</span></footer>
      </main>
    </div>
  );
}

