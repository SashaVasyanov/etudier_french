import { afterEach, describe, expect, it } from 'vitest';
import { flushProgressFile, setFileStoreInvoke } from '../src/lib/fileStore';
import { loadStorage, reconcileWithProgressFile, saveStorage } from '../src/lib/storage';
import { installStorage, progress, storage } from './fixtures';

function fakeFile(initial: string | null = null) {
  const file = { contents: initial, writes: 0 };
  setFileStoreInvoke(async (command, args) => {
    if (command === 'read_progress') return file.contents;
    if (command === 'write_progress') { file.contents = String(args?.contents); file.writes += 1; return null; }
    throw new Error(command);
  });
  return file;
}

describe('progress file copy', () => {
  afterEach(() => setFileStoreInvoke(undefined));

  it('mirrors every save to the file', async () => {
    installStorage();
    const file = fakeFile();
    saveStorage(storage({ a: progress('a', 'review') }));
    await flushProgressFile();
    expect(file.writes).toBe(1);
    expect(JSON.parse(file.contents!).payload.progressByWordId.a.status).toBe('review');
  });

  it('restores progress from the file when the WebView data is gone', async () => {
    installStorage();
    const file = fakeFile();
    saveStorage(storage({ a: progress('a', 'mastered') }));
    await flushProgressFile();
    const fresh = installStorage();
    expect(fresh.length).toBe(0);
    fakeFile(file.contents);
    const restored = await reconcileWithProgressFile();
    expect(restored?.progressByWordId.a.status).toBe('mastered');
    expect(loadStorage().storage.progressByWordId.a.status).toBe('mastered');
  });

  it('keeps localStorage when it is newer and refreshes the file', async () => {
    installStorage();
    const file = fakeFile();
    saveStorage(storage({ a: progress('a', 'learning') }));
    await flushProgressFile();
    const older = file.contents!.replace(/"savedAt":"[^"]+"/, '"savedAt":"2000-01-01T00:00:00.000Z"').replace('"learning"', '"new"');
    const stale = fakeFile(older);
    expect(await reconcileWithProgressFile()).toBeNull();
    expect(JSON.parse(stale.contents!).payload.progressByWordId.a.status).toBe('learning');
  });

  it('reports a save as done when localStorage is full but the file took it', async () => {
    const memory = installStorage();
    fakeFile();
    memory.failWrites = true;
    expect(saveStorage(storage()).ok).toBe(true);
    setFileStoreInvoke(null);
    expect(saveStorage(storage()).ok).toBe(false);
  });
});
