import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { ContactShadows, Grid, OrbitControls } from "@react-three/drei";
import { ChevronDown, ChevronRight, ChevronUp, Copy, Download, Pause, Play, Plus, Save, Sparkles, Trash2, Upload, Volume2 } from "lucide-react";
import Stickman from "./engine/Stickman";
import CameraAnimator from "./engine/CameraAnimator";
import EnvironmentStage from "./engine/EnvironmentStage";
import SceneProps from "./engine/SceneProps";
import { buildStoryboard } from "./core/storyboard";
import { createNarrationSubtitleCues } from "./core/narration";
import { createTopicScript } from "./core/topic-script";
import { buildRenderSchedule, evaluateRenderFrame, getFadeInOpacity, getRenderFileExtension, getRenderMimeType } from "./core/render";
import { getCenterCropRect, getYouTubeExportProfile, type YouTubeFormat, type YouTubeFrameRate } from "./core/youtube";
import { createPoseKeyframe, evaluateCamera } from "./core/animation";
import type { EvaluatedPose } from "./core/animation";
import { createProject, createScene, isAnimationProject, type AnimationProject, type AnimationScene, type Motion } from "./core/model";
import { duplicateScene, getTimelineCuePercent, moveScene, resizeSceneDuration } from "./core/timeline";
import { getSubtitleRenderStyle, type SubtitlePosition, type SubtitlePreset } from "./core/subtitle-style";
import { searchCommonsMedia, type CommonsSearchResult, type VisualMediaKind } from "./core/media-search";
import { deleteNarrationAudio, listProjects, loadNarrationAudio, saveNarrationAudio, saveProject as persistProject } from "./core/storage";
import { getPlaybackTime, setPlaybackTime } from "./core/playback";
import { beginAudioCapture, decodeNarrationAudio, endAudioCapture, getCrossedSoundEvents, playNarrationAudio, playNaturalSound, soundEffectLabels, unlockAudio } from "./core/sound";
import { distributeSubtitlesAcrossScenes, parseSubtitleFile, serializeSubtitles, type SubtitleFormat } from "./core/subtitles";
import type { CameraSettings, SceneSound, SubtitleCue } from "./core/model";

const motions: Motion[] = ["idle", "walk", "run", "jump", "wave"];

export default function App() {
  const [project, setProject] = useState<AnimationProject>(() => createProject());
  const importInput = useRef<HTMLInputElement>(null);
  const subtitleImportInput = useRef<HTMLInputElement>(null);
  const narrationAudioInput = useRef<HTMLInputElement>(null);
  const liveCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const liveRendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const liveSceneRef = useRef<THREE.Scene | null>(null);
  const orbitControlsRef = useRef<{ target: THREE.Vector3 } | null>(null);
  const [activeSceneId, setActiveSceneId] = useState(project.scenes[0].id);
  const [subtitleDraft, setSubtitleDraft] = useState("");
  const [speechVoices, setSpeechVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState("");
  const [narrationRate, setNarrationRate] = useState(1);
  const [narrationAudioInfo, setNarrationAudioInfo] = useState<{ name: string; type: string } | null>(null);
  const [narrationAudioUrl, setNarrationAudioUrl] = useState("");
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
  const [youtubeFormat, setYoutubeFormat] = useState<YouTubeFormat>("landscape");
  const [youtubeFps, setYoutubeFps] = useState<YouTubeFrameRate>(30);
  const [subtitlePreset, setSubtitlePreset] = useState<SubtitlePreset>("classic");
  const [subtitlePosition, setSubtitlePosition] = useState<SubtitlePosition>("bottom");
  const [mediaSearchQuery, setMediaSearchQuery] = useState("");
  const [mediaSearchKind, setMediaSearchKind] = useState<VisualMediaKind>("image");
  const [mediaSearchResults, setMediaSearchResults] = useState<CommonsSearchResult[]>([]);
  const [mediaSearchLoading, setMediaSearchLoading] = useState(false);
  const [pendingSceneSeek, setPendingSceneSeek] = useState<{ sceneId: string; atSeconds: number } | null>(null);
  const renderCancelRef = useRef(false);

  const activeScene = project.scenes.find((scene) => scene.id === activeSceneId) ?? project.scenes[0];
  const cameraSettings = useMemo(() => evaluateCamera(activeScene?.cameraKeyframes ?? [], playhead, activeScene?.camera ?? { position: [4.8, 3.2, 6.2], target: [0, 1.1, 0], fov: 42 }), [activeScene, playhead]);
  const totalDuration = useMemo(
    () => project.scenes.reduce((total, scene) => total + scene.durationSeconds, 0),
    [project.scenes],
  );
  const activeVisualAssets = (activeScene?.visualAssets ?? []).filter((asset) => playhead >= asset.startSeconds && playhead < asset.endSeconds);

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
    let cancelled = false;
    let objectUrl = "";
    setNarrationAudioInfo(null);
    setNarrationAudioUrl("");
    void loadNarrationAudio(project.id, activeSceneId).then((stored) => {
      if (cancelled || !stored) return;
      objectUrl = URL.createObjectURL(stored.blob);
      setNarrationAudioInfo({ name: stored.name, type: stored.type });
      setNarrationAudioUrl(objectUrl);
    }).catch(() => setMessage("Could not load this scene narration recording"));
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [project.id, activeSceneId]);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const refreshVoices = () => setSpeechVoices(window.speechSynthesis.getVoices());
    refreshVoices();
    window.speechSynthesis.addEventListener?.("voiceschanged", refreshVoices);
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", refreshVoices);
  }, []);

  useEffect(() => () => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  useEffect(() => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, [activeSceneId]);

  useEffect(() => {
    // Rendering drives the playhead frame-by-frame; do not reset it when the
    // renderer switches scenes or the first frame of each scene is lost.
    if (rendering) {
      setSelectedKeyframeId(null);
      setKeyframeTime(0);
      return;
    }
    setPlayhead(pendingSceneSeek?.sceneId === activeSceneId ? pendingSceneSeek.atSeconds : 0);
    setPlaybackTime(pendingSceneSeek?.sceneId === activeSceneId ? pendingSceneSeek.atSeconds : 0);
    if (pendingSceneSeek?.sceneId === activeSceneId) setPendingSceneSeek(null);
    setSelectedKeyframeId(null);
    setKeyframeTime(0);
  }, [activeSceneId, rendering, pendingSceneSeek]);

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

  async function importNarrationAudio(file?: File) {
    if (!file || !activeScene) return;
    try {
      await saveNarrationAudio(project.id, activeScene.id, file);
      setNarrationAudioInfo({ name: file.name, type: file.type });
      setNarrationAudioUrl(URL.createObjectURL(file));
      setMessage("Professional voice-over attached to this scene and saved locally");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not import narration audio");
    } finally {
      if (narrationAudioInput.current) narrationAudioInput.current.value = "";
    }
  }

  async function previewRecordedNarration() {
    if (!narrationAudioUrl) return;
    const audio = new Audio(narrationAudioUrl);
    audio.volume = 1;
    try {
      await audio.play();
      setMessage("Playing imported voice-over recording");
    } catch {
      setMessage("Could not play this audio file in the browser");
    }
  }

  async function removeNarrationAudio() {
    if (!activeScene) return;
    try {
      await deleteNarrationAudio(project.id, activeScene.id);
      setNarrationAudioInfo(null);
      setNarrationAudioUrl("");
      setMessage("Voice-over recording removed from this scene");
    } catch {
      setMessage("Could not remove the voice-over recording");
    }
  }

  function previewNarration() {
    if (!activeScene) return;
    if (!("speechSynthesis" in window)) {
      setMessage("Speech preview is not supported by this browser");
      return;
    }
    const text = (activeScene.narrationText ?? "").trim()
      || (activeScene.subtitles ?? []).slice().sort((a, b) => a.startSeconds - b.startSeconds).map((cue) => cue.text).join(" ");
    if (!text) {
      setMessage("Add narration text or subtitles to this scene first");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const language = /[\\u0600-\\u06FF]/u.test(text) ? "ar" : "en";
    utterance.lang = language;
    utterance.rate = narrationRate;
    const chosenVoice = speechVoices.find((voice) => voice.voiceURI === selectedVoiceURI);
    const matchingVoice = speechVoices.find((voice) => voice.lang.toLowerCase().startsWith(language));
    const compatibleVoice = chosenVoice?.lang.toLowerCase().startsWith(language) ? chosenVoice : matchingVoice;
    if (compatibleVoice) utterance.voice = compatibleVoice;
    utterance.onstart = () => setMessage("Narration preview playing · " + utterance.lang);
    utterance.onend = () => setMessage("Narration preview finished · audio is not yet included in video export");
    utterance.onerror = () => setMessage("Narration preview could not be played by this browser");
    window.speechSynthesis.speak(utterance);
  }

  function stopNarration() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setMessage("Narration preview stopped");
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

  function seekTimelineCue(sceneId: string, atSeconds: number) {
    setPlaying(false);
    if (sceneId === activeSceneId) {
      setPlayhead(atSeconds);
      setPlaybackTime(atSeconds);
      return;
    }
    setPendingSceneSeek({ sceneId, atSeconds });
    setActiveSceneId(sceneId);
  }

  function addScene() {
    const scene = createScene("Scene " + String(project.scenes.length + 1).padStart(2, "0"));
    updateProject({ scenes: [...project.scenes, scene] });
    setActiveSceneId(scene.id);
  }

  function reorderActiveScene(direction: -1 | 1) {
    if (!activeScene) return;
    const next = moveScene(project.scenes, activeScene.id, direction);
    if (next !== project.scenes) updateProject({ scenes: next });
  }

  function duplicateActiveScene() {
    if (!activeScene) return;
    const copy = duplicateScene(activeScene, activeScene.name + " copy");
    const index = project.scenes.findIndex((scene) => scene.id === activeScene.id);
    const scenes = [...project.scenes];
    scenes.splice(index + 1, 0, copy);
    updateProject({ scenes });
    setActiveSceneId(copy.id);
    setMessage("Scene duplicated with independent keyframes, subtitles, props, and sound cues");
  }

  function changeActiveSceneDuration(value: string) {
    if (!activeScene || value.trim() === "") return;
    const duration = Number(value);
    if (!Number.isFinite(duration) || duration < 0.5 || duration > 120) return;
    updateScene(resizeSceneDuration(activeScene, duration));
  }

  async function searchVisualMedia() {
    if (mediaSearchLoading) return;
    setMediaSearchLoading(true);
    try {
      const results = await searchCommonsMedia(mediaSearchQuery, mediaSearchKind);
      setMediaSearchResults(results);
      setMessage(results.length ? "Found " + results.length + " Commons " + mediaSearchKind + " assets" : "No matching media found. Try a broader topic.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Media search failed");
      setMediaSearchResults([]);
    } finally {
      setMediaSearchLoading(false);
    }
  }

  function addVisualAsset(result: CommonsSearchResult) {
    if (!activeScene) return;
    const visualAsset = {
      ...result,
      id: "visual_" + Math.random().toString(36).slice(2, 10),
      startSeconds: 0,
      endSeconds: Math.min(3, activeScene.durationSeconds),
    };
    updateScene({ visualAssets: [...(activeScene.visualAssets ?? []), visualAsset] });
    setMessage("Added visual reference to " + activeScene.name + " · " + result.license);
  }

  function removeVisualAsset(id: string) {
    if (!activeScene) return;
    updateScene({ visualAssets: (activeScene.visualAssets ?? []).filter((asset) => asset.id !== id) });
  }

  async function generateStory() {
    const topicScript = createTopicScript(story);
    const productionText = topicScript?.script ?? story;
    if (topicScript) setStory(productionText);
    const scenes = buildStoryboard(productionText);
    scenes.forEach((scene) => {
      scene.narrationText = scene.description;
      scene.subtitles = createNarrationSubtitleCues(scene.narrationText, scene.durationSeconds);
    });
    if (!scenes.length) {
      setMessage("Enter a topic or story first, then build scenes");
      return;
    }
    setMessage(topicScript
      ? "Created a free offline " + (topicScript.language === "ar" ? "Arabic" : "English") + " topic script · finding visuals…"
      : "Building scenes and finding supporting Commons media…");
    let attachedCount = 0;
    for (let index = 0; index < scenes.length; index += 1) {
      const scene = scenes[index];
      const preferredKind: VisualMediaKind = index % 3 === 1 ? "video" : "image";
      try {
        let results = await searchCommonsMedia(scene.description.slice(0, 100), preferredKind);
        if (!results.length && preferredKind === "video") {
          results = await searchCommonsMedia(scene.description.slice(0, 100), "image");
        }
        const result = results[0];
        if (result) {
          scene.visualAssets = [{
            ...result,
            id: "visual_" + Math.random().toString(36).slice(2, 10),
            startSeconds: 0,
            endSeconds: Math.min(3, scene.durationSeconds),
          }];
          attachedCount += 1;
        }
      } catch {
        // Keep the generated scene editable even when the public media source is unavailable.
      }
    }
    updateProject({ scenes });
    setActiveSceneId(scenes[0].id);
    setMessage("Created " + scenes.length + " editable scenes · attached " + attachedCount + " openly licensed visual assets when available");
  }

  async function renderVideo() {
    if (rendering) return;
    const canvas = document.querySelector<HTMLCanvasElement>(".viewport canvas");
    const mimeType = getRenderMimeType();
    if (!canvas || typeof canvas.captureStream !== "function" || !mimeType) {
      setMessage("Video recording is not supported by this browser");
      return;
    }
    const exportProfile = getYouTubeExportProfile(youtubeFormat, youtubeFps);
    const schedule = buildRenderSchedule(project.scenes, exportProfile.fps);
    if (!schedule.length) {
      setMessage("Add at least one scene before rendering");
      return;
    }
    if (schedule.length > exportProfile.fps * 90) {
      setMessage("This browser renderer is limited to 90 seconds per export");
      return;
    }

    const previousSceneId = activeSceneId;
    const previousTime = playhead;
    const wasPlaying = playing;
    const chunks: BlobPart[] = [];
    let stream: MediaStream | null = null;
    let recorder: MediaRecorder | null = null;
    let activeNarrationSource: AudioBufferSourceNode | null = null;
    const visualElements = new Map<string, HTMLImageElement | HTMLVideoElement>();
    const compositeCanvas = document.createElement("canvas");
    // Export a standard HD frame size regardless of the editor panel's dimensions.
    compositeCanvas.width = exportProfile.width;
    compositeCanvas.height = exportProfile.height;
    const previousCameraAspect = liveCameraRef.current?.aspect;
    const previousRendererSize = liveRendererRef.current?.getSize(new THREE.Vector2());
    const previousPixelRatio = liveRendererRef.current?.getPixelRatio();
    const compositeContext = compositeCanvas.getContext("2d");
    if (!compositeContext) {
      setMessage("Could not create the video compositing surface");
      return;
    }
    renderCancelRef.current = false;
    flushSync(() => {
      setRendering(true);
      setRenderProgress(0);
      setPlaying(false);
    });
    try {
      if (liveRendererRef.current) {
        // Render at delivery dimensions rather than stretching the editor viewport.
        liveRendererRef.current.setPixelRatio(1);
        liveRendererRef.current.setSize(exportProfile.width, exportProfile.height, false);
      }
      if (liveCameraRef.current) {
        liveCameraRef.current.aspect = exportProfile.width / exportProfile.height;
        liveCameraRef.current.updateProjectionMatrix();
      }
      const visualAssets = project.scenes.flatMap((scene) => scene.visualAssets ?? []);
      for (const asset of visualAssets) {
        if (visualElements.has(asset.id)) continue;
        if (asset.kind === "image") {
          const element = new Image();
          element.crossOrigin = "anonymous";
          await new Promise<void>((resolve, reject) => {
            element.onload = () => resolve();
            element.onerror = () => reject(new Error("Could not load visual asset: " + asset.title));
            element.src = asset.mediaUrl;
          });
          visualElements.set(asset.id, element);
        } else {
          const element = document.createElement("video");
          element.crossOrigin = "anonymous";
          element.muted = true;
          element.preload = "auto";
          await new Promise<void>((resolve, reject) => {
            element.onloadeddata = () => resolve();
            element.onerror = () => reject(new Error("This browser cannot decode video asset: " + asset.title));
            element.src = asset.mediaUrl;
            element.load();
          });
          visualElements.set(asset.id, element);
        }
      }
      let videoStream = compositeCanvas.captureStream(0);
      let manualVideoTrack = videoStream.getVideoTracks()[0] as (MediaStreamTrack & { requestFrame?: () => void }) | undefined;
      if (typeof manualVideoTrack?.requestFrame !== "function") {
        videoStream.getTracks().forEach((track) => track.stop());
        videoStream = compositeCanvas.captureStream(exportProfile.fps);
        manualVideoTrack = undefined;
      }
      const audioUnlocked = await unlockAudio();
      const audioStream = audioUnlocked ? beginAudioCapture() : null;
      const narrationBuffers = new Map<string, AudioBuffer>();
      if (audioUnlocked) {
        for (const scene of project.scenes) {
          const stored = await loadNarrationAudio(project.id, scene.id);
          if (stored) narrationBuffers.set(scene.id, await decodeNarrationAudio(stored.blob));
        }
      }
      const hasCapturedNarration = audioUnlocked && narrationBuffers.size > 0;
      const hasCapturedAudio = Boolean(audioStream?.getAudioTracks().length);
      stream = new MediaStream([...videoStream.getVideoTracks(), ...(audioStream?.getAudioTracks() ?? [])]);
      recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: exportProfile.videoBitsPerSecond });
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
      const stopped = new Promise<void>((resolve, reject) => {
        if (!recorder) return reject(new Error("Recorder could not start"));
        recorder.onerror = () => reject(new Error("Browser video recording failed"));
        recorder.onstop = () => resolve();
      });
      recorder.start(500);
      let renderedSceneId = "";
      let previousSceneTime = -1 / exportProfile.fps;
      for (let index = 0; index < schedule.length; index += 1) {
        if (renderCancelRef.current) break;
        const frameStartedAt = window.performance.now();
        const frame = schedule[index];
        const scene = project.scenes[frame.sceneIndex];
        if (scene.id !== renderedSceneId) {
          flushSync(() => setActiveSceneId(scene.id));
          renderedSceneId = scene.id;
          if (activeNarrationSource) {
            try { activeNarrationSource.stop(); } catch { /* already finished */ }
            activeNarrationSource = null;
          }
          const narrationBuffer = narrationBuffers.get(scene.id);
          if (narrationBuffer) activeNarrationSource = playNarrationAudio(narrationBuffer);
          previousSceneTime = -1 / exportProfile.fps;
        }
        const frameState = evaluateRenderFrame(scene, frame, previousSceneTime);
        for (const cue of frameState.soundEvents) playNaturalSound(cue.effect, cue.volume);
        previousSceneTime = frame.sceneTime;
        // Commit the exact scene-local timestamp before the next R3F paint.
        flushSync(() => {
          setPlaybackTime(frame.sceneTime);
          setPlayhead(frame.sceneTime);
        });
        // Wait for React and the R3F frame loop to apply the exact scene-local time.
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
          const elapsed = window.performance.now() - frameStartedAt;
          window.setTimeout(resolve, Math.max(0, 1000 / exportProfile.fps - elapsed));
        })));
        // Apply the camera after scene effects have run, so a scene switch cannot overwrite this frame's camera.
        const frameCamera = frameState.camera;
        if (liveCameraRef.current) {
          liveCameraRef.current.position.set(...frameCamera.position);
          liveCameraRef.current.lookAt(...frameCamera.target);
          liveCameraRef.current.fov = frameCamera.fov;
          liveCameraRef.current.updateProjectionMatrix();
        }
        orbitControlsRef.current?.target.set(...frameCamera.target);
        // Render synchronously after the exact camera is applied; otherwise the copied
        // WebGL canvas can still contain the previous camera frame.
        if (liveRendererRef.current && liveSceneRef.current && liveCameraRef.current) {
          liveRendererRef.current.render(liveSceneRef.current, liveCameraRef.current);
        }
        compositeContext.clearRect(0, 0, compositeCanvas.width, compositeCanvas.height);
        const crop = getCenterCropRect(canvas.width, canvas.height, compositeCanvas.width, compositeCanvas.height);
        compositeContext.drawImage(canvas, crop.x, crop.y, crop.width, crop.height, 0, 0, compositeCanvas.width, compositeCanvas.height);
        const fadeOpacity = getFadeInOpacity(frame.sceneTime, scene.fadeInSeconds ?? 0);
        if (fadeOpacity > 0) {
          compositeContext.fillStyle = "rgba(0, 0, 0, " + fadeOpacity + ")";
          compositeContext.fillRect(0, 0, compositeCanvas.width, compositeCanvas.height);
        }
        for (const asset of (scene.visualAssets ?? []).filter((item) => frame.sceneTime >= item.startSeconds && frame.sceneTime < item.endSeconds)) {
          const element = visualElements.get(asset.id);
          if (!element) continue;
          if (element instanceof HTMLVideoElement) {
            const targetTime = Math.max(0, frame.sceneTime - asset.startSeconds);
            if (Number.isFinite(element.duration)) {
              const boundedTime = Math.min(targetTime, Math.max(0, element.duration - 0.04));
              if (Math.abs(element.currentTime - boundedTime) > 0.04) {
                await new Promise<void>((resolve) => {
                  element.addEventListener("seeked", () => resolve(), { once: true });
                  element.currentTime = boundedTime;
                });
              }
            }
          }
          const mediaWidth = element instanceof HTMLVideoElement ? element.videoWidth : element.naturalWidth;
          const mediaHeight = element instanceof HTMLVideoElement ? element.videoHeight : element.naturalHeight;
          if (!mediaWidth || !mediaHeight) continue;
          const scale = Math.max(compositeCanvas.width / mediaWidth, compositeCanvas.height / mediaHeight);
          const drawWidth = mediaWidth * scale;
          const drawHeight = mediaHeight * scale;
          compositeContext.drawImage(element, (compositeCanvas.width - drawWidth) / 2, (compositeCanvas.height - drawHeight) / 2, drawWidth, drawHeight);
        }
        const activeCues = frameState.activeSubtitles;
        if (activeCues.length) {
          const width = compositeCanvas.width;
          const height = compositeCanvas.height;
          const captionStyle = getSubtitleRenderStyle(subtitlePreset, subtitlePosition, width, height);
          const fontSize = captionStyle.fontSize;
          compositeContext.font = captionStyle.fontWeight + " " + fontSize + "px Arial, sans-serif";
          compositeContext.textAlign = "center";
          compositeContext.textBaseline = "middle";
          for (const cue of activeCues) {
            const words = cue.text.split(/\s+/);
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
            const lineHeight = fontSize * captionStyle.lineHeight;
            const blockHeight = lines.length * lineHeight + fontSize * captionStyle.verticalPadding;
            const centerY = height * captionStyle.verticalAnchor - blockHeight / 2;
            const maxLineWidth = Math.max(...lines.map((item) => compositeContext.measureText(item).width));
            const boxWidth = Math.min(width * 0.9, maxLineWidth + fontSize * captionStyle.horizontalPadding);
            if (captionStyle.backgroundAlpha > 0) {
              compositeContext.fillStyle = "rgba(8, 11, 20, " + captionStyle.backgroundAlpha + ")";
              compositeContext.beginPath();
              compositeContext.roundRect((width - boxWidth) / 2, centerY - blockHeight / 2, boxWidth, blockHeight, fontSize * 0.35);
              compositeContext.fill();
            }
            compositeContext.fillStyle = "#ffffff";
            compositeContext.lineJoin = "round";
            compositeContext.lineWidth = captionStyle.outlineWidth;
            compositeContext.strokeStyle = "rgba(0, 0, 0, 0.9)";
            compositeContext.direction = /[\u0600-\u06FF]/.test(cue.text) ? "rtl" : "ltr";
            lines.forEach((item, lineIndex) => {
              const y = centerY - ((lines.length - 1) * lineHeight) / 2 + lineIndex * lineHeight;
              if (captionStyle.outlineWidth > 0) compositeContext.strokeText(item, width / 2, y, width * 0.84);
              compositeContext.fillText(item, width / 2, y, width * 0.84);
            });
          }
        }
        // Request the frame only after both the 3D scene and subtitle overlay are composed.
        manualVideoTrack?.requestFrame?.();
        if (index % 5 === 0 || index === schedule.length - 1) {
          setRenderProgress(Math.round(((index + 1) / schedule.length) * 100));
        }
      }
      // Give the final manually requested frame one more browser paint/encode turn
      // before stopping MediaRecorder, so the last scene frame is not truncated.
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())));
      recorder.stop();
      await stopped;
      if (!renderCancelRef.current && chunks.length) {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        const safeTitle = project.title.trim().replace(/[^a-z0-9-_]+/gi, "-") || "stickmotion-video";
        anchor.href = url;
        const fileExtension = getRenderFileExtension(mimeType);
        anchor.download = safeTitle + "." + fileExtension;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 30000);
        setMessage("Video exported as " + fileExtension.toUpperCase() + " · " + exportProfile.label + " · " + exportProfile.fps + " FPS · timed subtitles" + (hasCapturedNarration ? " · pro voice-over included" : "") + (hasCapturedAudio ? " · natural sound effects included" : " · browser audio capture unavailable"));
      } else {
        setMessage("Video render cancelled");
      }
    } catch (error) {
      if (recorder && recorder.state !== "inactive") recorder.stop();
      setMessage(error instanceof Error ? error.message : "Video render failed");
    } finally {
      if (activeNarrationSource) {
        try { activeNarrationSource.stop(); } catch { /* already finished */ }
      }
      stream?.getTracks().forEach((track) => track.stop());
      endAudioCapture();
      if (liveRendererRef.current && previousRendererSize && previousPixelRatio !== undefined) {
        liveRendererRef.current.setPixelRatio(previousPixelRatio);
        liveRendererRef.current.setSize(previousRendererSize.x, previousRendererSize.y, false);
      }
      if (liveCameraRef.current && previousCameraAspect !== undefined) {
        liveCameraRef.current.aspect = previousCameraAspect;
        liveCameraRef.current.updateProjectionMatrix();
        if (liveRendererRef.current && liveSceneRef.current) liveRendererRef.current.render(liveSceneRef.current, liveCameraRef.current);
      }
      flushSync(() => {
        setActiveSceneId(previousSceneId);
        setPlaybackTime(previousTime);
        setPlayhead(previousTime);
        setPlaying(wasPlaying);
        setRendering(false);
      });
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
          <div className="top-actions"><label className="export-preset-label">YOUTUBE <select aria-label="YouTube export format" value={youtubeFormat} disabled={rendering} onChange={(event) => setYoutubeFormat(event.target.value as YouTubeFormat)}><option value="landscape">16:9 · 1080p</option><option value="shorts">9:16 Shorts</option><option value="square">1:1 Square</option></select></label><label className="export-preset-label">FPS <select aria-label="Export frame rate" value={youtubeFps} disabled={rendering} onChange={(event) => setYoutubeFps(Number(event.target.value) as YouTubeFrameRate)}><option value={24}>24</option><option value={30}>30</option><option value={60}>60</option></select></label><button className="save-button render-button" disabled={rendering} onClick={() => void renderVideo()}><Download size={14}/>{rendering ? "Rendering " + renderProgress + "%" : "Render video"}</button>{rendering && <button className="save-button cancel-render-button" onClick={cancelRender}>Cancel</button>}<input ref={importInput} className="file-input-hidden" type="file" accept=".json,application/json" aria-label="Import StickMotion project" onChange={(event) => void importProject(event.target.files?.[0])}/><button className="save-button transfer-button" onClick={() => importInput.current?.click()}><Upload size={14}/> Import JSON</button><button className="save-button transfer-button" onClick={exportProject}><Download size={14}/> Export JSON</button><button className="save-button" onClick={() => void save()}><Save size={15}/> Save project</button></div>
        </header>

        <section className="workspace">
          <div className="center-column">
            <div className="section-title"><div><h1>{project.title}</h1><p>Build scenes, direct your character, and shape your animation.</p></div><input aria-label="Project title" value={project.title} onChange={(event) => updateProject({ title: event.target.value })}/></div>
            <div className="viewport-card">
              <div className="viewport-top"><span>3D VIEWPORT <i/> LIVE PREVIEW</span><span>Perspective · Orbit to inspect</span></div>
              <div className="viewport">
                <Canvas shadows dpr={2} gl={{ preserveDrawingBuffer: true }} camera={{ position: cameraSettings.position, fov: cameraSettings.fov }} onCreated={({ camera, gl, scene }) => { if (camera instanceof THREE.PerspectiveCamera) liveCameraRef.current = camera; liveRendererRef.current = gl; liveSceneRef.current = scene; }}>
                  <EnvironmentStage environment={activeScene?.environment ?? "studio"}/>
                  <SceneProps props={activeScene?.props ?? []} interaction={activeScene?.interaction} timeSeconds={rendering ? playhead : undefined} durationSeconds={activeScene?.durationSeconds ?? 4}/>
                  <ambientLight intensity={activeScene?.environment === "night" ? 0.48 : activeScene?.environment === "nature" ? 0.88 : 0.75}/>
                  <directionalLight position={[4, 8, 5]} color={activeScene?.environment === "night" ? "#aab8ff" : activeScene?.environment === "nature" ? "#fff0cf" : "#ffffff"} intensity={activeScene?.environment === "night" ? 1.25 : 2.1} castShadow shadow-mapSize={[1024, 1024]}/>
                  {activeScene?.environment === "studio" && <Grid position={[0, -0.03, 0]} args={[18, 18]} cellSize={0.5} cellColor="#343b52" sectionColor="#59627d" fadeDistance={20} infiniteGrid/>}
                  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]} receiveShadow><planeGeometry args={[100, 100]}/><meshStandardMaterial color={activeScene?.environment === "nature" ? "#385a3b" : activeScene?.environment === "night" ? "#0c1022" : "#171c2b"} roughness={0.95}/></mesh>
                  <Stickman color={project.character.primaryColor} motion={activeScene?.motion ?? "idle"} durationSeconds={activeScene?.durationSeconds ?? 4} keyframes={activeScene?.keyframes ?? []} transform={activeScene?.characterTransform} timeSeconds={rendering ? playhead : undefined} travelOnJump={Boolean(activeScene?.props?.length) && (/\b(over|onto|across|above)\b|فوق|عبر/.test(activeScene?.description ?? ""))} interaction={activeScene?.interaction}/>
                  <ContactShadows position={[0, -0.045, 0]} opacity={0.38} scale={5} blur={2.4} far={2}/>
                  <CameraAnimator settings={cameraSettings} animate={playing && !rendering && Boolean(activeScene?.cameraKeyframes?.length)} sceneId={activeSceneId}/><OrbitControls ref={(controls) => { orbitControlsRef.current = controls as unknown as { target: THREE.Vector3 } | null; }} enabled={!rendering && !(playing && Boolean(activeScene?.cameraKeyframes?.length))} target={cameraSettings.target} minDistance={3} maxDistance={12} maxPolarAngle={Math.PI / 2.02}/>
                </Canvas>
                <div className="scene-fade-overlay" style={{ opacity: getFadeInOpacity(playhead, activeScene?.fadeInSeconds ?? 0) }}/>
                {activeVisualAssets.length > 0 && <div className="visual-media-overlay">{activeVisualAssets.map((asset) => asset.kind === "video" ? <video key={asset.id} src={asset.mediaUrl} muted autoPlay loop playsInline/> : <img key={asset.id} src={asset.mediaUrl} alt={asset.title}/>)}</div>}<div className="viewport-caption">{activeScene?.name ?? "No scene"} · {(activeScene?.motion ?? "idle").toUpperCase()}</div>{(activeScene?.subtitles ?? []).filter((cue) => playhead >= cue.startSeconds && playhead < cue.endSeconds).map((cue) => <div className={"subtitle-preview subtitle-preview-" + subtitlePreset + " subtitle-position-" + subtitlePosition} key={cue.id}>{cue.text}</div>)}
              </div>
              <div className="viewport-controls"><div>SCENE {String(Math.max(1, project.scenes.findIndex((scene) => scene.id === activeSceneId) + 1)).padStart(2, "0")} / {String(project.scenes.length).padStart(2, "0")}</div><button className="play-button" onClick={() => { if (!playing) void unlockAudio(); setPlaying((value) => !value); }}>{playing ? <Pause size={16}/> : <Play size={16}/>} {playing ? "Pause" : "Play"}</button><div>{playhead.toFixed(1)}s / {activeScene?.durationSeconds ?? 4}s · {totalDuration}s total</div></div>
            </div>

            <div className="timeline-card">
              <div className="timeline-heading"><div><h2>Timeline</h2><small>SCENE SEQUENCE</small></div><button className="add-button" onClick={addScene}><Plus size={14}/> Add scene</button></div>
              <div className="timeline-track">
                {project.scenes.map((scene, index) => <button key={scene.id} className={scene.id === activeSceneId ? "scene-card selected" : "scene-card"} style={{ flex: Math.max(1, scene.durationSeconds) }} onClick={() => setActiveSceneId(scene.id)}><small>{String(index + 1).padStart(2, "0")} · {scene.durationSeconds}s</small><strong>{scene.name}</strong><span>{scene.motion}</span></button>)}
              </div>
              <div className="timeline-lanes" aria-label="Multi-track timeline">
                {project.scenes.map((scene, index) => <div className={scene.id === activeSceneId ? "timeline-lane-scene active" : "timeline-lane-scene"} key={scene.id} style={{ flex: Math.max(1, scene.durationSeconds) }}>
                  <button className="timeline-lane-title" onClick={() => setActiveSceneId(scene.id)}>{String(index + 1).padStart(2, "0")} · {scene.name}</button>
                  <div className="timeline-lane-row"><span className="timeline-lane-label">CAPTIONS</span><div className="timeline-lane-track">{(scene.subtitles ?? []).map((cue) => <button key={cue.id} className="timeline-cue caption-cue" title={cue.text + " · " + cue.startSeconds.toFixed(1) + "s"} style={{ left: getTimelineCuePercent(cue.startSeconds, scene.durationSeconds) + "%", width: Math.max(4, getTimelineCuePercent(cue.endSeconds - cue.startSeconds, scene.durationSeconds)) + "%" }} onClick={() => seekTimelineCue(scene.id, cue.startSeconds)}>{cue.text}</button>)}</div></div>
                  <div className="timeline-lane-row"><span className="timeline-lane-label">SFX</span><div className="timeline-lane-track">{scene.sounds.map((cue) => <button key={cue.id} className="timeline-cue sound-cue-marker" title={soundEffectLabels[cue.effect] + " · " + cue.atSeconds.toFixed(1) + "s"} style={{ left: getTimelineCuePercent(cue.atSeconds, scene.durationSeconds) + "%" }} onClick={() => seekTimelineCue(scene.id, cue.atSeconds)}>{soundEffectLabels[cue.effect]}</button>)}</div></div><div className="timeline-lane-row"><span className="timeline-lane-label">MEDIA</span><div className="timeline-lane-track">{(scene.visualAssets ?? []).map((asset) => <button key={asset.id} className="timeline-cue media-cue-marker" title={asset.title + " · " + asset.kind} style={{ left: getTimelineCuePercent(asset.startSeconds, scene.durationSeconds) + "%", width: Math.max(5, getTimelineCuePercent(asset.endSeconds - asset.startSeconds, scene.durationSeconds)) + "%" }} onClick={() => seekTimelineCue(scene.id, asset.startSeconds)}>{asset.kind === "video" ? "VIDEO" : "IMAGE"}</button>)}</div></div>
                  <div className="timeline-lane-row"><span className="timeline-lane-label">POSE</span><div className="timeline-lane-track">{(scene.keyframes ?? []).map((frame) => <button key={frame.id} className="timeline-cue pose-cue-marker" title={"Pose keyframe · " + frame.atSeconds.toFixed(1) + "s"} style={{ left: getTimelineCuePercent(frame.atSeconds, scene.durationSeconds) + "%" }} onClick={() => seekTimelineCue(scene.id, frame.atSeconds)}>◆</button>)}</div></div>
                  <div className="timeline-lane-row"><span className="timeline-lane-label">CAMERA</span><div className="timeline-lane-track">{(scene.cameraKeyframes ?? []).map((frame) => <button key={frame.id} className="timeline-cue camera-cue-marker" title={"Camera keyframe · " + frame.atSeconds.toFixed(1) + "s"} style={{ left: getTimelineCuePercent(frame.atSeconds, scene.durationSeconds) + "%" }} onClick={() => seekTimelineCue(scene.id, frame.atSeconds)}>◆</button>)}</div></div>
                </div>)}
              </div>
              {activeScene && <div className="scene-edit-tools">
                <label className="scene-name-edit"><span className="field-label">SCENE NAME</span><input className="text-input" aria-label="Selected scene name" value={activeScene.name} maxLength={80} onChange={(event) => updateScene({ name: event.target.value })}/></label>
                <label className="scene-duration-edit"><span className="field-label">DURATION (SEC)</span><input className="text-input" aria-label="Selected scene duration in seconds" type="number" min="0.5" max="120" step="0.5" value={activeScene.durationSeconds} onChange={(event) => changeActiveSceneDuration(event.target.value)}/></label>
                <label className="scene-fade-edit"><span className="field-label">FADE IN</span><select className="text-input" aria-label="Scene fade in duration" value={activeScene.fadeInSeconds ?? 0} onChange={(event) => updateScene({ fadeInSeconds: Number(event.target.value) })}><option value={0}>Off</option><option value={0.25} disabled={activeScene.durationSeconds < 0.25}>0.25 sec</option><option value={0.5} disabled={activeScene.durationSeconds < 0.5}>0.5 sec</option><option value={1} disabled={activeScene.durationSeconds < 1}>1 sec</option><option value={2} disabled={activeScene.durationSeconds < 2}>2 sec</option><option value={3} disabled={activeScene.durationSeconds < 3}>3 sec</option></select></label>
                <div className="scene-order-actions">
                  <button className="add-button" onClick={() => reorderActiveScene(-1)} disabled={project.scenes.findIndex((scene) => scene.id === activeSceneId) === 0} title="Move scene earlier"><ChevronUp size={14}/> Move up</button>
                  <button className="add-button" onClick={() => reorderActiveScene(1)} disabled={project.scenes.findIndex((scene) => scene.id === activeSceneId) === project.scenes.length - 1} title="Move scene later"><ChevronDown size={14}/> Move down</button>
                  <button className="add-button" onClick={duplicateActiveScene}><Copy size={14}/> Duplicate</button>
                  <button className="add-button scene-delete-action" onClick={removeScene} disabled={project.scenes.length <= 1}><Trash2 size={14}/> Delete</button>
                </div>
              </div>}
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
            <section className="inspector-section subtitle-section"><div className="section-heading"><h3>Subtitles</h3><span className="beta-tag">LOCAL</span></div><p>Add timed captions in Arabic or English. Preview them at the current playhead.</p><div className="subtitle-style-controls"><label><span className="field-label">CAPTION STYLE</span><select className="text-input" aria-label="Subtitle style" value={subtitlePreset} onChange={(event) => setSubtitlePreset(event.target.value as SubtitlePreset)}><option value="classic">Classic · boxed</option><option value="bold">Bold · large</option><option value="minimal">Minimal · outlined</option></select></label><label><span className="field-label">POSITION</span><select className="text-input" aria-label="Subtitle position" value={subtitlePosition} onChange={(event) => setSubtitlePosition(event.target.value as SubtitlePosition)}><option value="bottom">Bottom</option><option value="center">Center</option></select></label></div><textarea className="description-input" rows={2} maxLength={500} value={subtitleDraft} onChange={(event) => setSubtitleDraft(event.target.value)} placeholder="Type a caption / اكتب الترجمة هنا..."/><button className="generate-button" disabled={!subtitleDraft.trim()} onClick={addSubtitleCue}><Plus size={14}/> Add subtitle at {playhead.toFixed(1)}s</button><div className="subtitle-cue-list">{(activeScene?.subtitles ?? []).map((cue) => <div className="subtitle-cue subtitle-cue-edit" key={cue.id}>
                <div className="subtitle-cue-heading"><span>{cue.startSeconds.toFixed(2)}–{cue.endSeconds.toFixed(2)}s</span><button className="icon-action" aria-label="Delete subtitle" onClick={() => updateScene({subtitles:(activeScene?.subtitles ?? []).filter((item)=>item.id!==cue.id)})}><Trash2 size={13}/></button></div>
                <input className="subtitle-text-input" aria-label="Edit subtitle text" maxLength={500} value={cue.text} onChange={(event) => updateSubtitleCue(cue.id, { text: event.target.value })}/>
                <label className="field-label">START <b>{cue.startSeconds.toFixed(2)}s</b></label>
                <input aria-label="Subtitle start time" className="duration-range" type="range" min="0" max={Math.max(0, cue.endSeconds - 0.1)} step="0.05" value={cue.startSeconds} onChange={(event) => updateSubtitleCue(cue.id, { startSeconds: Number(event.target.value) })}/>
                <label className="field-label">END <b>{cue.endSeconds.toFixed(2)}s</b></label>
                <input aria-label="Subtitle end time" className="duration-range" type="range" min={Math.min(activeScene?.durationSeconds ?? 4, cue.startSeconds + 0.1)} max={activeScene?.durationSeconds ?? 4} step="0.05" value={cue.endSeconds} onChange={(event) => updateSubtitleCue(cue.id, { endSeconds: Number(event.target.value) })}/>
                <button className="cue-time" onClick={() => { setPlaying(false); setPlayhead(cue.startSeconds); setPlaybackTime(cue.startSeconds); }}>Preview from start</button>
              </div>)}{!(activeScene?.subtitles?.length) && <small className="empty-projects">No subtitles in this scene yet.</small>}</div>
              <div className="subtitle-export-actions"><input ref={subtitleImportInput} className="file-input-hidden" type="file" accept=".srt,.vtt,text/vtt,application/x-subrip" aria-label="Import SRT or WebVTT subtitles" onChange={(event) => void importSubtitleFile(event.target.files?.[0])}/><button className="sound-add" onClick={() => subtitleImportInput.current?.click()}><Upload size={12}/> Import SRT/VTT</button><button className="sound-add" onClick={() => exportSubtitleFile("srt")}><Download size={12}/> Export SRT</button><button className="sound-add" onClick={() => exportSubtitleFile("vtt")}><Download size={12}/> Export VTT</button></div></section>
                         <section className="inspector-section narration-section"><div className="section-heading"><h3>Pro voice-over</h3><span className="beta-tag">AUDIO EXPORT</span></div><p>Import a professionally recorded Arabic or English voice-over (MP3, WAV, M4A, or OGG). The recording is saved locally for this scene, previewable, and mixed into the exported video. No paid API is required.</p><input ref={narrationAudioInput} className="file-input-hidden" type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg" aria-label="Import professional narration audio" onChange={(event) => void importNarrationAudio(event.target.files?.[0])}/><div className="subtitle-export-actions"><button className="sound-add" onClick={() => narrationAudioInput.current?.click()}><Upload size={12}/> Import pro voice-over</button><button className="sound-add" disabled={!narrationAudioUrl} onClick={() => void previewRecordedNarration()}><Play size={12}/> Preview recording</button>{narrationAudioInfo && <button className="sound-add" onClick={() => void removeNarrationAudio()}>Remove</button>}</div>{narrationAudioInfo ? <small className="empty-projects">Attached: {narrationAudioInfo.name} · included in video export</small> : <small className="empty-projects">No recorded voice-over attached to this scene. Import a studio-quality recording to use in your final video.</small>}<label className="field-label">SCRIPT / NARRATION TEXT</label><textarea className="description-input" rows={4} maxLength={5000} value={activeScene?.narrationText ?? ""} onChange={(event) => updateScene({ narrationText: event.target.value })} placeholder="Write the spoken line for this scene… / اكتب التعليق الصوتي لهذا المشهد…"/><div className="section-heading"><h3>Quick browser voice test</h3><span className="beta-tag">BASIC</span></div><p>Optional system voice preview only; it is not the professional recording and is not exported.</p><label className="field-label">VOICE</label><select className="text-input" aria-label="Browser test voice" value={selectedVoiceURI} onChange={(event) => setSelectedVoiceURI(event.target.value)}><option value="">Automatic · match narration language</option>{speechVoices.map((voice) => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} · {voice.lang}{voice.default ? " · default" : ""}</option>)}</select><label className="field-label">SPEAKING SPEED <b>{narrationRate.toFixed(1)}×</b></label><input className="duration-range" aria-label="Narration speaking speed" type="range" min="0.7" max="1.3" step="0.1" value={narrationRate} onChange={(event) => setNarrationRate(Number(event.target.value))}/><div className="subtitle-export-actions"><button className="sound-add" disabled={!activeScene?.narrationText?.trim() && !(activeScene?.subtitles?.length)} onClick={previewNarration}><Volume2 size={12}/> Test system voice</button><button className="sound-add" onClick={stopNarration}>Stop voice</button></div></section>
                         <section className="inspector-section media-search-section"><div className="section-heading"><h3>Supporting visuals</h3><span className="beta-tag">FREE MEDIA</span></div><p>Find openly licensed reference images and video clips from Wikimedia Commons. Check each source and license before publishing.</p><div className="media-search-row"><input className="text-input" aria-label="Search supporting media" value={mediaSearchQuery} onChange={(event) => setMediaSearchQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void searchVisualMedia(); }} placeholder="e.g. volcano eruption, solar system..."/><select className="text-input" aria-label="Media type" value={mediaSearchKind} onChange={(event) => { setMediaSearchKind(event.target.value as VisualMediaKind); setMediaSearchResults([]); }}><option value="image">Images</option><option value="video">Videos</option></select><button className="generate-button" disabled={mediaSearchLoading || mediaSearchQuery.trim().length < 2} onClick={() => void searchVisualMedia()}>{mediaSearchLoading ? "Searching…" : "Search"}</button></div><div className="media-search-results">{mediaSearchResults.map((result) => <div className="media-result" key={result.id}><img src={result.thumbnailUrl} alt={result.title} loading="lazy"/><div className="media-result-info"><strong>{result.title}</strong><small>{result.kind.toUpperCase()} · {result.license}</small><small>{result.attribution}</small><a href={result.sourceUrl} target="_blank" rel="noreferrer">View source and terms</a><button className="sound-add" onClick={() => addVisualAsset(result)}>Add to scene</button></div></div>)}{mediaSearchResults.length === 0 && <small className="empty-projects">Search to find free community media.</small>}</div><div className="attached-visuals"><strong>Scene media · {activeScene?.visualAssets?.length ?? 0}</strong>{(activeScene?.visualAssets ?? []).map((asset) => <div className="attached-visual" key={asset.id}><span>{asset.kind === "video" ? "VIDEO" : "IMAGE"} · {asset.title}<small>{asset.startSeconds.toFixed(1)}–{asset.endSeconds.toFixed(1)}s · {asset.license}</small></span><button className="icon-action" aria-label={"Remove " + asset.title} onClick={() => removeVisualAsset(asset.id)}><Trash2 size={13}/></button></div>)}</div></section>
<section className="inspector-section story-section"><div className="section-heading"><h3>Prompt to video</h3><span className="beta-tag">STORYBOARD BETA</span></div><p>Describe the action, mood, camera shot, and setting. Build editable scenes, then search Wikimedia Commons for supporting images and video clips with source and license details. The renderer selects native MP4/H.264 when this browser supports it; otherwise it exports WebM.</p><textarea className="story-input" rows={6} value={story} onChange={(event) => setStory(event.target.value)} placeholder="Enter a topic (e.g. black holes / الثقوب السوداء) or paste a full script. Short topics become a 4-part offline educational script..."/><button className="generate-button" onClick={generateStory}><Sparkles size={15}/> Build video + find visuals</button></section>
            <div className="inspector-status"><i/> {message}</div>
          </aside>
        </section>
        <footer className="app-footer"><span>STICKMOTION AI · 0.2 DEVELOPMENT</span><span>NO BACKGROUND MUSIC · NATURAL SFX DIRECTION</span></footer>
      </main>
    </div>
  );
}

