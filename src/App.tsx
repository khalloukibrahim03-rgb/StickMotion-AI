import { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Grid, OrbitControls } from "@react-three/drei";
import { ChevronRight, Pause, Play, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import Stickman from "./engine/Stickman";
import { buildStoryboard } from "./core/storyboard";
import { createProject, createScene, type AnimationProject, type AnimationScene, type Motion } from "./core/model";
import { listProjects, saveProject as persistProject } from "./core/storage";

const motions: Motion[] = ["idle", "walk", "run", "jump", "wave"];

export default function App() {
  const [project, setProject] = useState<AnimationProject>(() => createProject());
  const [activeSceneId, setActiveSceneId] = useState(project.scenes[0].id);
  const [story, setStory] = useState("A curious stickman walks into a quiet room. It notices a strange object and jumps in surprise. Then it waves hello.");
  const [playing, setPlaying] = useState(true);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("Local workspace ready");
  const [recentProjects, setRecentProjects] = useState<AnimationProject[]>([]);

  const activeScene = project.scenes.find((scene) => scene.id === activeSceneId) ?? project.scenes[0];
  const totalDuration = useMemo(
    () => project.scenes.reduce((total, scene) => total + scene.durationSeconds, 0),
    [project.scenes],
  );

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
                  <Stickman color={project.character.primaryColor} motion={activeScene?.motion ?? "idle"} playing={playing}/>
                  <ContactShadows position={[0, -0.045, 0]} opacity={0.38} scale={5} blur={2.4} far={2}/>
                  <OrbitControls target={[0, 1.1, 0]} minDistance={3} maxDistance={12} maxPolarAngle={Math.PI / 2.02}/>
                </Canvas>
                <div className="viewport-caption">{activeScene?.name ?? "No scene"} · {(activeScene?.motion ?? "idle").toUpperCase()}</div>
              </div>
              <div className="viewport-controls"><div>SCENE {String(Math.max(1, project.scenes.findIndex((scene) => scene.id === activeSceneId) + 1)).padStart(2, "0")} / {String(project.scenes.length).padStart(2, "0")}</div><button className="play-button" onClick={() => setPlaying((value) => !value)}>{playing ? <Pause size={16}/> : <Play size={16}/>} {playing ? "Pause" : "Play"}</button><div>{totalDuration}s total</div></div>
            </div>

            <div className="timeline-card">
              <div className="timeline-heading"><div><h2>Timeline</h2><small>SCENE SEQUENCE</small></div><button className="add-button" onClick={addScene}><Plus size={14}/> Add scene</button></div>
              <div className="timeline-track">
                {project.scenes.map((scene, index) => <button key={scene.id} className={scene.id === activeSceneId ? "scene-card selected" : "scene-card"} style={{ flex: Math.max(1, scene.durationSeconds) }} onClick={() => setActiveSceneId(scene.id)}><small>{String(index + 1).padStart(2, "0")} · {scene.durationSeconds}s</small><strong>{scene.name}</strong><span>{scene.motion}</span></button>)}
              </div>
              <div className="timeline-foot"><span>{project.scenes.length} scenes</span><span>Natural sound effects only · {totalDuration} seconds</span></div>
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
            <section className="inspector-section story-section"><div className="section-heading"><h3>Story builder</h3><span className="beta-tag">OFFLINE</span></div><p>Turn a short story into editable scenes. Motion suggestions use local rules, not a generative AI model.</p><textarea className="story-input" rows={5} value={story} onChange={(event) => setStory(event.target.value)} placeholder="Describe your animation..."/><button className="generate-button" onClick={generateStory}><Sparkles size={15}/> Generate scenes</button></section>
            <div className="inspector-status"><i/> {message}</div>
          </aside>
        </section>
        <footer className="app-footer"><span>STICKMOTION AI · 0.2 DEVELOPMENT</span><span>NO BACKGROUND MUSIC · NATURAL SFX DIRECTION</span></footer>
      </main>
    </div>
  );
}
