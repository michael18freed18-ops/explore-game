// @ts-nocheck
const KEY = "stillmere-save-v1";

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.found)) return [];
    return parsed.found.filter((n) => Number.isInteger(n));
  } catch {
    return [];
  }
}

export function writeSave(found) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, found: [...found] }));
  } catch {
    /* private mode */
  }
}
