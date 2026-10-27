/**
 * A copy of all progress in a file next to the app's data
 * (~/Library/Application Support/com.etudier.french/progress.json on macOS).
 *
 * The WebView's localStorage stays the working copy: it is synchronous and
 * the app starts from it. Every save is mirrored to the file shortly after,
 * and at start-up the newer of the two wins. So progress survives cleared
 * WebView data and a full localStorage quota. Outside the desktop app (tests,
 * browser preview) there is no file and everything here is a no-op.
 */

type Invoke = (command: string, args?: Record<string, unknown>) => Promise<unknown>;

let invokeOverride: Invoke | null | undefined;

/** Tests replace the Tauri bridge here. */
export function setFileStoreInvoke(invoke: Invoke | null | undefined): void {
  invokeOverride = invoke;
  pending = null;
  if (timer !== null) clearTimeout(timer);
  timer = null;
}

/** The Tauri bridge, or null outside the desktop app. */
export function getTauriInvoke(): Invoke | null {
  return getInvoke();
}

function getInvoke(): Invoke | null {
  if (invokeOverride !== undefined) return invokeOverride;
  if (typeof window === 'undefined') return null;
  const internals = (window as unknown as { __TAURI_INTERNALS__?: { invoke?: Invoke } }).__TAURI_INTERNALS__;
  return typeof internals?.invoke === 'function' ? internals.invoke.bind(internals) : null;
}

export function hasFileStore(): boolean {
  return getInvoke() !== null;
}

export async function readProgressFile(): Promise<string | null> {
  const invoke = getInvoke();
  if (!invoke) return null;
  try {
    const result = await invoke('read_progress');
    return typeof result === 'string' && result.trim() ? result : null;
  } catch {
    return null;
  }
}

const WRITE_DELAY_MS = 600;
let lastWriteAt: Date | null = null;
let lastWriteFailed = false;
let pending: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let writing: Promise<void> | null = null;

export interface ProgressFileStatus {
  path: string | null;
  lastWriteAt: Date | null;
  failed: boolean;
}

/** Where the file is and when it was last written (for the backup panel). */
export async function getProgressFileStatus(): Promise<ProgressFileStatus | null> {
  const invoke = getInvoke();
  if (!invoke) return null;
  let path: string | null = null;
  try {
    const result = await invoke('progress_location');
    path = typeof result === 'string' ? result : null;
  } catch {
    path = null;
  }
  return { path, lastWriteAt, failed: lastWriteFailed };
}

/** Mirror the serialized storage to the file a moment later (the latest wins). */
export function scheduleProgressFileWrite(serialized: string): void {
  if (!getInvoke()) return;
  pending = serialized;
  if (timer !== null) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void flushProgressFile();
  }, WRITE_DELAY_MS);
}

/** Write the pending copy now (on hide or before quitting). */
export async function flushProgressFile(): Promise<void> {
  const invoke = getInvoke();
  if (!invoke) return;
  if (writing) await writing;
  if (pending === null) return;
  const contents = pending;
  pending = null;
  writing = (async () => {
    try {
      await invoke('write_progress', { contents });
      lastWriteAt = new Date();
      lastWriteFailed = false;
    } catch {
      // A failed mirror must never break studying; the next save retries.
      lastWriteFailed = true;
      if (pending === null) pending = contents;
    }
  })();
  await writing;
  writing = null;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushProgressFile();
  });
  window.addEventListener('pagehide', () => void flushProgressFile());
}
