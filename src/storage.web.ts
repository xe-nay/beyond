// Browser stand-in for the design preview: the same API backed by localStorage.
export const photosDir = null;

export function loadJson<T>(name: string): T | null {
  try {
    const v = localStorage.getItem(`beyond:${name}`);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

export function saveJson(name: string, value: unknown) {
  try {
    localStorage.setItem(`beyond:${name}`, JSON.stringify(value));
  } catch {}
}

export const keepPhoto = (uri: string) => uri;
export const deletePhoto = (_uri: string) => {};

export function cacheText(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  return url;
}

export async function readUri(uri: string) {
  return (await fetch(uri)).text();
}

// The browser plays clips straight from the web.
export const voiceUri = (_id: string): string | null => null;
export async function downloadVoice(_id: string, url: string) {
  return url;
}
