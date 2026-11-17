// Client-side helpers for the local FastAPI backend.
//
// All requests go to the backend defined by VITE_API_BASE (default
// http://127.0.0.1:8000). During development, the Vite proxy also forwards
// /api/* to the backend, so calls work with or without the env var.

import type { Voice, Generation } from "./types";

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || "http://127.0.0.1:8000";

function url(path: string): string {
  return `${API_BASE}${path}`;
}

// Resolve a relative audio_url (e.g. "/audio/gen_123.mp3") to a full URL.
export function resolveAudioUrl(audioUrl: string): string {
  if (audioUrl.startsWith("http")) return audioUrl;
  return `${API_BASE}${audioUrl}`;
}

async function readError(resp: Response): Promise<string> {
  let detail = `Request failed (${resp.status})`;
  try {
    const data = await resp.json();
    if (data?.detail) detail = String(data.detail);
    else if (data?.message) detail = String(data.message);
  } catch {
    // non-JSON body
  }
  return detail;
}

// Check whether the Pocket TTS engine is available on the backend.
export async function getTtsStatus(): Promise<{ available: boolean; error: string | null }> {
  try {
    const resp = await fetch(url("/tts/status"));
    if (!resp.ok) return { available: false, error: await readError(resp) };
    const data = (await resp.json()) as { available: boolean; error: string | null };
    return { available: data.available, error: data.error };
  } catch (err) {
    return { available: false, error: (err as Error).message };
  }
}

// --- Voices ---

export async function listVoices(): Promise<Voice[]> {
  const resp = await fetch(url("/voices"));
  if (!resp.ok) throw new Error(await readError(resp));
  return (await resp.json()) as Voice[];
}

export async function createVoice(name: string, language: string, file: File): Promise<Voice> {
  const form = new FormData();
  form.append("name", name);
  form.append("language", language);
  form.append("audio", file, file.name || "sample.wav");

  const resp = await fetch(url("/voices"), {
    method: "POST",
    body: form,
  });
  if (!resp.ok) throw new Error(await readError(resp));
  return (await resp.json()) as Voice;
}

export async function deleteVoice(voiceId: string): Promise<void> {
  const resp = await fetch(url(`/voices/${voiceId}`), { method: "DELETE" });
  if (!resp.ok) throw new Error(await readError(resp));
}

// --- Generate ---

export async function generateSpeech(
  voiceId: string,
  text: string,
  language: string,
  speed: number
): Promise<Generation> {
  const resp = await fetch(url("/generate"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ voice_id: voiceId, text, language, speed }),
  });
  if (!resp.ok) throw new Error(await readError(resp));
  return (await resp.json()) as Generation;
}

export async function listHistory(limit = 50): Promise<Generation[]> {
  const resp = await fetch(url(`/generate/history?limit=${limit}`));
  if (!resp.ok) throw new Error(await readError(resp));
  return (await resp.json()) as Generation[];
}

export async function deleteGeneration(id: string): Promise<void> {
  const resp = await fetch(url(`/generate/${id}`), { method: "DELETE" });
  if (!resp.ok) throw new Error(await readError(resp));
}

// --- Backup / restore ---

export async function exportBackup(): Promise<{ url: string; filename: string }> {
  const resp = await fetch(url("/backup/export"), { method: "POST" });
  if (!resp.ok) throw new Error(await readError(resp));
  return (await resp.json()) as { url: string; filename: string };
}

export async function restoreBackup(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const resp = await fetch(url("/backup/restore"), { method: "POST", body: form });
  if (!resp.ok) throw new Error(await readError(resp));
  const data = (await resp.json()) as { message: string };
  return data.message;
}
