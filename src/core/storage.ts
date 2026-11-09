import { isAnimationProject, type AnimationProject } from "./model";

const DATABASE_NAME = "stickmotion-workspace";
const DATABASE_VERSION = 2;
const PROJECT_STORE = "projects";
const NARRATION_STORE = "narrationAudio";

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available in this browser."));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(NARRATION_STORE)) {
        database.createObjectStore(NARRATION_STORE, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(PROJECT_STORE)) {
        const store = database.createObjectStore(PROJECT_STORE, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open project database."));
    request.onblocked = () => reject(new Error("Project database upgrade is blocked by another tab."));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

export async function saveProject(project: AnimationProject): Promise<void> {
  if (!isAnimationProject(project)) throw new Error("Invalid or unsupported project schema.");
  const database = await openDatabase();
  try {
    const transaction = database.transaction(PROJECT_STORE, "readwrite");
    transaction.objectStore(PROJECT_STORE).put({
      ...project,
      updatedAt: new Date().toISOString(),
    });
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Project save failed."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Project save was cancelled."));
    });
  } finally {
    database.close();
  }
}

export async function loadProject(id: string): Promise<AnimationProject | null> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(PROJECT_STORE, "readonly");
    const value = await requestResult<unknown>(transaction.objectStore(PROJECT_STORE).get(id));
    if (value == null) return null;
    if (!isAnimationProject(value)) {
      throw new Error("This project uses an unsupported schema version.");
    }
    return value;
  } finally {
    database.close();
  }
}

export async function listProjects(): Promise<AnimationProject[]> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(PROJECT_STORE, "readonly");
    const values = await requestResult<unknown[]>(transaction.objectStore(PROJECT_STORE).getAll());
    return values.filter(isAnimationProject)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } finally {
    database.close();
  }
}

export async function deleteProject(id: string): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(PROJECT_STORE, "readwrite");
    transaction.objectStore(PROJECT_STORE).delete(id);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Project deletion failed."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Project deletion was cancelled."));
    });
  } finally {
    database.close();
  }
}


export interface StoredNarrationAudio {
  blob: Blob;
  name: string;
  type: string;
}

function narrationAudioId(projectId: string, sceneId: string): string {
  return projectId + ":" + sceneId;
}

export async function saveNarrationAudio(projectId: string, sceneId: string, file: File): Promise<void> {
  if (!file.type.startsWith("audio/")) throw new Error("Choose an audio file such as MP3, WAV, or M4A.");
  if (file.size > 40 * 1024 * 1024) throw new Error("Narration audio must be 40 MB or smaller.");
  const database = await openDatabase();
  try {
    const transaction = database.transaction(NARRATION_STORE, "readwrite");
    transaction.objectStore(NARRATION_STORE).put({
      id: narrationAudioId(projectId, sceneId),
      blob: file,
      name: file.name,
      type: file.type,
    });
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Narration audio save failed."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Narration audio save was cancelled."));
    });
  } finally {
    database.close();
  }
}

export async function loadNarrationAudio(projectId: string, sceneId: string): Promise<StoredNarrationAudio | null> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(NARRATION_STORE, "readonly");
    const value = await requestResult<{ blob: Blob; name: string; type: string } | undefined>(
      transaction.objectStore(NARRATION_STORE).get(narrationAudioId(projectId, sceneId)),
    );
    return value ? { blob: value.blob, name: value.name, type: value.type } : null;
  } finally {
    database.close();
  }
}

export async function deleteNarrationAudio(projectId: string, sceneId: string): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(NARRATION_STORE, "readwrite");
    transaction.objectStore(NARRATION_STORE).delete(narrationAudioId(projectId, sceneId));
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Narration audio removal failed."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Narration audio removal was cancelled."));
    });
  } finally {
    database.close();
  }
}
