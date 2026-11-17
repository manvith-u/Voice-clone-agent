# Project memory

## Product intent & audience

- **VoiceClone Studio**: web app for users to clone their own voice from a short recording and generate speech from pasted text using that cloned voice.
- Audience: individual users wanting personal voice TTS (stories, narration). Requires an ElevenLabs plan that supports voice cloning (Starter+).

## Brand personality & voice

- Friendly but professional; ethically conscious (consent and permission are front-and-center, not afterthoughts).
- Clear, plain-language error messages that explain *why* something failed (e.g., plan doesn't allow cloning).

## Visual design & UX direction

- Clean dark theme; fully responsive (mobile + desktop).
- Top navigation between three pages: Create a Voice, Generate Speech, My Voices.
- Lucide React icons for UI/logo. No extra UI/icon packages.
- `@/` path alias maps to `src/` — use it instead of deep relative imports.
- Toast notifications for all user-facing errors (invalid key, quota exceeded, network failure).
- Footer note on every page: "Only clone voices you own or have permission to use."
- Custom audio player with play/pause and Download MP3.
- Progress bar shown during multi-chunk TTS generation.

## Decisions, constraints & rationale

- **Security**: ElevenLabs API key never in client code. Supabase Edge Functions proxy all API calls; key read from `ELEVENLABS_API_KEY` secret.
- Four edge functions deployed: `list-voices` (GET /voices), `create-voice` (POST /voices/add multipart), `delete-voice` (DELETE /voices/{id}), `text-to-speech` (POST /text-to-speech/{id}).
- TTS model: `eleven_multilingual_v2`; output MP3.
- Long text auto-split at sentence boundaries into ≤2,500-char chunks; chunks processed sequentially and joined into one MP3 blob.
- Speed slider range: 0.7x–1.2x.
- Voice dropdown shows cloned voices first, then others; each voice has a preview button.
- Create Voice: supports file upload (mp3/wav/m4a) or in-browser MediaRecorder (record/stop/playback/re-record) with timer and recording tip.
- Required consent checkbox gates the Create button (disabled until checked).
- History: last 10 generations stored in localStorage with replay + download.
- Delete voice requires confirmation.
- README includes setup note for adding `ELEVENLABS_API_KEY` Supabase secret.

## Open questions & assumptions

- Assumes user has Supabase project provisioned and CLI available for edge function deployment and secret setting.
- Assumes ElevenLabs plan supports voice cloning; if not, app surfaces a clear error but cannot create voices.
- Speed adjustment implementation (voice settings vs. audio player playbackRate) not explicitly finalized in build.
- No auth/RBAC layer on edge functions yet — assumed single-user or trusted context.