// Page 1: Create a Voice.
// Record in-browser or upload an audio file, name the voice, confirm consent,
// then send the sample to the local FastAPI backend which builds a reusable
// voice profile with Pocket TTS.

import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, Square, Upload, Play, Pause, RefreshCw, CheckCircle2, ShieldCheck, Lock } from "lucide-react";
import { Button } from "@/components/Button";
import { useToast } from "@/components/Toast";
import { createVoice, getTtsStatus } from "@/lib/api";

type RecorderState = "idle" | "recording" | "recorded";

export function CreateVoicePage({ onCreated }: { onCreated: () => void }) {
  const { toast } = useToast();

  const [mode, setMode] = useState<"upload" | "record">("record");

  // Upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Recording state
  const [recorderState, setRecorderState] = useState<RecorderState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState("");
  const [isPlayingBack, setIsPlayingBack] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const playbackRef = useRef<HTMLAudioElement | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("english");
  const [consented, setConsented] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ttsReady, setTtsReady] = useState<boolean | null>(null);

  // Check backend TTS availability on mount.
  useEffect(() => {
    getTtsStatus().then((s) => setTtsReady(s.available));
  }, []);

  const sampleFile = useMemo<File | null>(() => {
    if (mode === "upload") return uploadedFile;
    if (mode === "record" && recordedBlob) {
      return new File([recordedBlob], "recording.webm", { type: recordedBlob.type || "audio/webm" });
    }
    return null;
  }, [mode, uploadedFile, recordedBlob]);

  const canSubmit = Boolean(name.trim() && consented && sampleFile && !submitting && ttsReady !== false);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setRecordedBlob(blob);
        if (recordedUrl) URL.revokeObjectURL(recordedUrl);
        setRecordedUrl(URL.createObjectURL(blob));
        setRecorderState("recorded");
        streamRef.current?.getTracks().forEach((t) => t.stop());
      };

      recorder.start();
      setRecorderState("recording");
      setSeconds(0);
      setRecordedBlob(null);
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (err) {
      toast("error", `Microphone unavailable: ${(err as Error).message}`);
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function reRecord() {
    setRecordedBlob(null);
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl("");
    setRecorderState("idle");
    setSeconds(0);
  }

  function togglePlayback() {
    if (!playbackRef.current) return;
    if (isPlayingBack) playbackRef.current.pause();
    else void playbackRef.current.play();
  }

  function onUploadChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const okType = /\.(mp3|wav|m4a|webm|ogg|flac)$/i.test(file.name) || file.type.startsWith("audio/");
    if (!okType) {
      toast("error", "Please choose an audio file (mp3, wav, or m4a).");
      return;
    }
    setUploadedFile(file);
  }

  async function handleSubmit() {
    if (!sampleFile || !name.trim()) return;
    setSubmitting(true);
    try {
      const voice = await createVoice(name.trim(), language, sampleFile);
      toast("success", `Voice "${voice.name}" created and saved locally.`);
      setName("");
      setConsented(false);
      setUploadedFile(null);
      reRecord();
      onCreated();
    } catch (err) {
      toast("error", `Could not create voice: ${(err as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  const mm = Math.floor(seconds / 60).toString().padStart(2, "0");
  const ss = Math.floor(seconds % 60).toString().padStart(2, "0");

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">Create a Voice</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Record or upload a clean sample of your voice. It&apos;s processed locally and saved on your computer.
        </p>
      </header>

      {/* Backend status warning */}
      {ttsReady === false && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-950/40 p-4 text-sm text-amber-200">
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div>
            <p className="font-medium">Backend not ready</p>
            <p className="mt-1 text-amber-200/80">
              The Pocket TTS backend isn&apos;t running or isn&apos;t installed. Start it with
              <code className="mx-1 rounded bg-amber-900/50 px-1.5 py-0.5 text-xs">uvicorn app.main:app --port 8000</code>
              from the <code className="rounded bg-amber-900/50 px-1.5 py-0.5 text-xs">backend</code> folder.
            </p>
          </div>
        </div>
      )}

      {/* Source toggle */}
      <div className="mb-6 inline-flex rounded-xl border border-zinc-800 bg-zinc-900/60 p-1">
        <ToggleTab active={mode === "record"} onClick={() => setMode("record")} icon={<Mic className="h-4 w-4" />}>
          Record
        </ToggleTab>
        <ToggleTab active={mode === "upload"} onClick={() => setMode("upload")} icon={<Upload className="h-4 w-4" />}>
          Upload
        </ToggleTab>
      </div>

      {/* Recorder / uploader */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
        {mode === "record" ? (
          <div className="flex flex-col items-center gap-5">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-6 py-4 text-center">
              <div className="text-3xl font-mono tabular-nums text-zinc-100">{mm}:{ss}</div>
              <div className="mt-1 text-xs text-zinc-500">
                {recorderState === "recording" ? "Recording…" : "Ready"}
              </div>
            </div>

            {recorderState === "recording" && (
              <div className="flex items-center gap-2 text-rose-400">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" />
                <span className="text-xs font-medium">Live</span>
              </div>
            )}

            {recorderState === "idle" && (
              <Button onClick={startRecording} variant="primary">
                <Mic className="h-4 w-4" />
                Start recording
              </Button>
            )}

            {recorderState === "recording" && (
              <Button onClick={stopRecording} variant="danger">
                <Square className="h-4 w-4" />
                Stop
              </Button>
            )}

            {recorderState === "recorded" && recordedUrl && (
              <div className="w-full">
                <audio
                  ref={playbackRef}
                  src={recordedUrl}
                  onPlay={() => setIsPlayingBack(true)}
                  onPause={() => setIsPlayingBack(false)}
                  onEnded={() => setIsPlayingBack(false)}
                />
                <div className="mt-3 flex justify-center gap-2">
                  <Button onClick={togglePlayback} variant="secondary">
                    {isPlayingBack ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    {isPlayingBack ? "Pause" : "Play back"}
                  </Button>
                  <Button onClick={reRecord} variant="ghost">
                    <RefreshCw className="h-4 w-4" />
                    Re-record
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-700 bg-zinc-950/40 px-6 py-10 text-center transition-colors hover:border-sky-500/50 hover:bg-zinc-900/60"
            >
              <Upload className="h-8 w-8 text-zinc-500" />
              <span className="mt-3 text-sm font-medium text-zinc-200">
                {uploadedFile ? uploadedFile.name : "Click to choose an audio file"}
              </span>
              <span className="mt-1 text-xs text-zinc-500">MP3, WAV, or M4A</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.m4a"
              onChange={onUploadChange}
              className="hidden"
            />
            {uploadedFile && (
              <Button onClick={() => setUploadedFile(null)} variant="ghost">
                <RefreshCw className="h-4 w-4" />
                Remove file
              </Button>
            )}
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-zinc-500">
        Tip: Record 1–3 minutes of clear speech, no background noise or music.
      </p>

      {/* Voice name + language */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="voice-name" className="block text-sm font-medium text-zinc-300">
            Voice name
          </label>
          <input
            id="voice-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. My Narrator Voice"
            maxLength={60}
            className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-sky-500/60 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          />
        </div>
        <div>
          <label htmlFor="voice-lang" className="block text-sm font-medium text-zinc-300">
            Language
          </label>
          <select
            id="voice-lang"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-2.5 text-sm text-zinc-100 focus:border-sky-500/60 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          >
            <option value="english">English</option>
            <option value="french">French</option>
            <option value="spanish">Spanish</option>
            <option value="german">German</option>
            <option value="italian">Italian</option>
            <option value="portuguese">Portuguese</option>
          </select>
        </div>
      </div>

      {/* Consent */}
      <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 transition-colors hover:bg-zinc-900/60">
        <input
          type="checkbox"
          checked={consented}
          onChange={(e) => setConsented(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 rounded border-zinc-600 bg-zinc-800 accent-sky-500"
        />
        <span className="text-sm text-zinc-300">
          I confirm this is my own voice, or I have the explicit permission of the person whose voice this is.
        </span>
      </label>

      <div className="mt-6">
        <Button onClick={handleSubmit} disabled={!canSubmit} loading={submitting} className="w-full sm:w-auto">
          {submitting ? (
            "Processing voice…"
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Create voice
            </>
          )}
        </Button>
      </div>

      <div className="mt-6 flex items-start gap-2 rounded-lg border border-emerald-700/30 bg-emerald-950/20 p-3 text-xs text-emerald-200/80">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
        <span>Your recording is processed locally and stored on your computer. VoiceClone Studio does not upload your recordings to external cloud storage.</span>
      </div>
    </div>
  );
}

function ToggleTab({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        active ? "bg-sky-500 text-white" : "text-zinc-400 hover:text-zinc-200"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
