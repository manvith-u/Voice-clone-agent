// localStorage history for the last 10 speech generations.
//
// Audio is served by the backend, so we only persist lightweight metadata
// here (text + voice + audio URL). The backend keeps full history too;
// this is for fast access in the Generate page.

import type { GenerationHistoryItem } from "./types";

const KEY = "voiceclone.history.v1";
const MAX = 10;

export function loadHistory(): GenerationHistoryItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as GenerationHistoryItem[];
  } catch {
    return [];
  }
}

export function saveHistory(items: GenerationHistoryItem[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
  } catch {
    // localStorage may be full; ignore.
  }
}

export function addHistory(item: GenerationHistoryItem): GenerationHistoryItem[] {
  const next = [item, ...loadHistory()].slice(0, MAX);
  saveHistory(next);
  return next;
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
