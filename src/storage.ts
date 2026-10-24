// On-device JSON storage in the app's documents folder. Writes go to a temp file first so a crash
// mid-write never loses the previous state.
import { Directory, File, Paths } from 'expo-file-system';

const root = new Directory(Paths.document, 'beyond');
export const photosDir = new Directory(root, 'photos');

function ensure() {
  for (const d of [root, photosDir]) if (!d.exists) d.create({ intermediates: true, idempotent: true });
}

function read<T>(file: File): T | null {
  if (!file.exists) return null;
  try {
    return JSON.parse(file.textSync()) as T;
  } catch {
    return null;
  }
}

export function loadJson<T>(name: string): T | null {
  ensure();
  return read<T>(new File(root, name)) ?? read<T>(new File(root, `${name}.tmp`));
}

export function saveJson(name: string, value: unknown) {
  ensure();
  const temp = new File(root, `${name}.tmp`);
  temp.create({ overwrite: true });
  temp.write(JSON.stringify(value));
  const target = new File(root, name);
  if (target.exists) target.delete();
  temp.copySync(target);
}

/** Copies a picked photo into private app storage; returns its local URI. */
export function keepPhoto(uri: string, id: string) {
  ensure();
  const dest = new File(photosDir, `${id}.jpg`);
  if (dest.exists) dest.delete();
  new File(uri).copySync(dest);
  return dest.uri;
}

export function deletePhoto(uri: string) {
  const f = new File(uri);
  if (f.exists) f.delete();
}

/** Writes text to a cache file and returns its URI, for sharing exports. */
export function cacheText(name: string, text: string) {
  const f = new File(Paths.cache, name);
  f.create({ overwrite: true });
  f.write(text);
  return f.uri;
}

export async function readUri(uri: string) {
  return new File(uri).text();
}

const voicesDir = new Directory(root, 'voices');

/** Local copy of a downloaded voice clip, if present. */
export function voiceUri(id: string) {
  const f = new File(voicesDir, `${id}.mp3`);
  return f.exists && f.size > 1000 ? f.uri : null;
}

export async function downloadVoice(id: string, url: string) {
  if (!voicesDir.exists) voicesDir.create({ intermediates: true, idempotent: true });
  const dest = new File(voicesDir, `${id}.mp3`);
  if (dest.exists) dest.delete();
  const file = await File.downloadFileAsync(url, dest);
  return file.uri;
}
