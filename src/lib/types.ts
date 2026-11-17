// Shared types for the local FastAPI backend.

export interface Voice {
  id: string;
  name: string;
  language: string;
  original_audio: string | null;
  created_at: string;
}

export interface Generation {
  id: string;
  voice_id: string;
  voice_name: string | null;
  text: string;
  language: string;
  speed: number;
  audio_url: string;
  created_at: string;
}

// A lightweight history entry kept in React localStorage for quick access.
// Audio is served by the backend at `audio_url`.
export interface GenerationHistoryItem {
  id: string;
  voiceId: string;
  voiceName: string;
  textPreview: string;
  fullText: string;
  speed: number;
  createdAt: number;
  audioUrl: string;
}
