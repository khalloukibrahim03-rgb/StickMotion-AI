import { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Grid, OrbitControls } from "@react-three/drei";
import { ChevronRight, Pause, Play, Plus, Save, Sparkles, Trash2, Volume2 } from "lucide-react";
import Stickman from "./engine/Stickman";
import { buildStoryboard } from "./core/storyboard";
import { createPoseKeyframe } from "./core/animation";
import type { EvaluatedPose } from "./core/animation";
import { createProject, createScene, type AnimationProject, type AnimationScene, type Motion } from "./core/model";
import { listProjects, saveProject as persistProject } from "./core/storage";
import { getPlaybackTime, setPlaybackTime } from "./core/playback";
import { getCrossedSoundEvents, playNaturalSound, soundEffectLabels, unlockAudio } from "./core/sound";
import type { SceneSound } from "./core/model";

const motions: Motion[] = ["idle", "walk", "run", "jump", "wave"];

export default function App() {
  const [project, setProject] = useState<AnimationProject>(() => createProject());
  const [activeSceneId, setActiveSceneId] = useState(project.scenes[0].id);
  const [story, setStory] = useState("A curious stickman walks into a quiet room. It notices a strange object and jumps in surprise. Then it waves hello.");
  const [playing, setPlaying] = useState(true);
  const [playhead, setPlayhead] = useState(0);
  const [keyframeTime, setKeyframeTime] = useState(0);
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

  const activeScene = project.scenes.find((scene) => scene.id === activeSceneId) ?? project.scenes[0];
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
    updateScene({ keyframes: [...frames, updated].sort((a, b) => a.atSeconds - b.atSeconds) });
    setPlayhead(keyframeTime);
    setPlaybackTime(keyframeTime);
    setMessage("Selected keyframe updated");
  }

  function selectKeyframe(frame: NonNullable<AnimationScene["keyframes"]>[number]) {
    const degrees = (radians: number) => Math.round(radians * 180 / Math.PI);
    setSelectedKeyframeId(frame.id);
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
          <div className="top-actions"><button className="save-button" onClick={() => void save()}><Save size={15}/> Save project</button></div>
        </header>

        <section className="workspace">
          <div className="center-column">
            <div className="section-title"><div><h1>{project.title}</h1><p>Build scenes, direct your character, and shape your animation.</p></div><input aria-label="Project title" value={project.title} onChange={(event) => updateProject({ title: event.target.value })}/></div>
            <div className="viewport-card">
              <div className="viewport-top"><span>3D VIEWPORT <i/> LIVE PREVIEW</span><span>Perspective · Orbit to inspect</span></div>
              <div className="viewport">
                <Canvas shadows camera={{ position: [4.8, 3.2, 6.2], fov: 42 }}>
                  <color attach="background" args={["#111522"]}/>
                  <ambientLight intensity={0.75}/>
                  <directionalLight position={[4, 8, 5]} intensity={2.1} castShadow shadow-mapSize={[1024, 1024]}/>
                  <Grid position={[0, -0.03, 0]} args={[18, 18]} cellSize={0.5} cellColor="#343b52" sectionColor="#59627d" fadeDistance={20} infiniteGrid/>
                  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]} receiveShadow><planeGeometry args={[100, 100]}/><meshStandardMaterial color="#171c2b" roughness={0.95}/></mesh>
                  <Stickman color={project.character.primaryColor} motion={activeScene?.motion ?? "idle"} playing={playing} keyframes={activeScene?.keyframes ?? []}/>
                  <ContactShadows position={[0, -0.045, 0]} opacity={0.38} scale={5} blur={2.4} far={2}/>
                  <OrbitControls target={[0, 1.1, 0]} minDistance={3} maxDistance={12} maxPolarAngle={Math.PI / 2.02}/>
                </Canvas>
                <div className="viewport-caption">{activeScene?.name ?? "No scene"} · {(activeScene?.motion ?? "idle").toUpperCase()}</div>
              </div>
              <div className="viewport-controls"><div>SCENE {String(Math.max(1, project.scenes.findIndex((scene) => scene.id === activeSceneId) + 1)).padStart(2, "0")} / {String(project.scenes.length).padStart(2, "0")}</div><button className="play-button" onClick={() => { if (!playing) void unlockAudio(); setPlaying((value) => !value); }}>{playing ? <Pause size={16}/> : <Play size={16}/>} {playing ? "Pause" : "Play"}</button><div>{playhead.toFixed(1)}s / {activeScene?.durationSeconds ?? 4}s · {totalDuration}s total</div></div>
            </div>

            <div className="timeline-card">
              <div className="timeline-heading"><div><h2>Timeline</h2><small>SCENE SEQUENCE</small></div><button className="add-button" onClick={addScene}><Plus size={14}/> Add scene</button></div>
              <div className="timeline-track">
                {project.scenes.map((scene, index) => <button key={scene.id} className={scene.id === activeSceneId ? "scene-card selected" : "scene-card"} style={{ flex: Math.max(1, scene.durationSeconds) }} onClick={() => setActiveSceneId(scene.id)}><small>{String(index + 1).padStart(2, "0")} · {scene.durationSeconds}s</small><strong>{scene.name}</strong><span>{scene.motion}</span></button>)}
              </div>
              <div className="keyframe-tools"><div><label className="field-label">KEYFRAME TIME <b>{keyframeTime.toFixed(1)}s</b></label><input aria-label="Keyframe time" className="duration-range" type="range" min="0" max={Math.max(0.1, activeScene?.durationSeconds ?? 4)} step="0.1" value={Math.min(keyframeTime, activeScene?.durationSeconds ?? 4)} onChange={(event) => setKeyframeTime(Number(event.target.value))}/></div><div className="keyframe-pose">
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
            </section>
            <section className="inspector-section sound-section"><div className="section-heading"><h3><Volume2 size={15}/> Natural sound effects</h3><span className="beta-tag">SFX</span></div><p>Place short sound cues on this scene. Audio is synthesized locally; no music is included.</p><label className="field-label">EFFECT</label><select className="text-input" value={soundEffect} onChange={(event) => setSoundEffect(event.target.value as SceneSound["effect"])}>{(Object.keys(soundEffectLabels) as SceneSound["effect"][]).map((effect) => <option key={effect} value={effect}>{soundEffectLabels[effect]}</option>)}</select><label className="field-label">VOLUME <b>{Math.round(soundVolume * 100)}%</b></label><input aria-label="Sound effect volume" className="duration-range" type="range" min="0" max="1" step="0.05" value={soundVolume} onChange={(event) => setSoundVolume(Number(event.target.value))}/><div className="sound-actions"><button className="add-button" onClick={() => void previewSound()}><Play size={13}/> Preview</button><button className="generate-button" onClick={addSoundCue}><Plus size={14}/> Add cue at {keyframeTime.toFixed(1)}s</button></div><div className="sound-cue-list">{(activeScene?.sounds ?? []).map((cue) => <div className="sound-cue" key={cue.id}><span><strong>{soundEffectLabels[cue.effect]}</strong><small>{cue.atSeconds.toFixed(1)}s · {Math.round(cue.volume * 100)}%</small></span><button className="icon-action" aria-label={"Delete " + soundEffectLabels[cue.effect]} onClick={() => removeSoundCue(cue.id)}><Trash2 size={14}/></button></div>)}{(activeScene?.sounds ?? []).length === 0 && <small className="empty-projects">No sound cues in this scene yet.</small>}</div></section>
            <section className="inspector-section story-section"><div className="section-heading"><h3>Story builder</h3><span className="beta-tag">OFFLINE</span></div><p>Turn a short story into editable scenes. Motion suggestions use local rules, not a generative AI model.</p><textarea className="story-input" rows={5} value={story} onChange={(event) => setStory(event.target.value)} placeholder="Describe your animation..."/><button className="generate-button" onClick={generateStory}><Sparkles size={15}/> Generate scenes</button></section>
            <div className="inspector-status"><i/> {message}</div>
          </aside>
        </section>
        <footer className="app-footer"><span>STICKMOTION AI · 0.2 DEVELOPMENT</span><span>NO BACKGROUND MUSIC · NATURAL SFX DIRECTION</span></footer>
      </main>
    </div>
  );
}

