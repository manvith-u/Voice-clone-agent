// Page 2: Generate Speech.
// Pick a voice, paste text, adjust speed, then generate via the local
// FastAPI backend. The backend splits long text at sentence boundaries,
// synthesizes each chunk, joins them into one MP3, and saves it.
// Recent generations are listed for replay/download.

import { useEffect, useMemo, useState } from "react";
import { Wand2, ChevronDown, History, Play } from "lucide-react";
import { Button } from "@/components/Button";
import { AudioPlayer } from "@/components/AudioPlayer";
import { useToast } from "@/components/Toast";
import { generateSpeech, listVoices } from "@/lib/api";
import { resolveAudioUrl } from "@/lib/api";
import { addHistory, loadHistory } from "@/lib/history";
import type { Voice, GenerationHistoryItem } from "@/lib/types";

const MAX_CHARS = 10000;
const CHUNK_SIZE = 2500;

// Rough sentence-boundary chunk count estimate for the UI.
function estimateChunks(text: string): number {
  if (text.length <= CHUNK_SIZE) return 1;
  return Math.ceil(text.length / CHUNK_SIZE);
}

export function GenerateSpeechPage({ refreshKey }: { refreshKey: number }) {
  const { toast } = useToast();

  const [voices, setVoices] = useState<Voice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [text, setText] = useState("");
  const [speed, setSpeed] = useState(1);
  const [busy, setBusy] = useState(false);
  const [resultUrl, setResultUrl] = useState("");
  const [resultName, setResultName] = useState("");
  const [history, setHistory] = useState<GenerationHistoryItem[]>([]);

  const selectedVoice = voices.find((v) => v.id === selectedId) || null;

  useEffect(() => {
    let active = true;
    setLoadingVoices(true);
    listVoices()
      .then((v) => {
        if (!active) return;
        setVoices(v);
        setSelectedId(v[0]?.id || "");
      })
      .catch((err) => toast("error", `Could not load voices: ${(err as Error).message}`))
      .finally(() => active && setLoadingVoices(false));
    return () => {
      active = false;
    };
  }, [refreshKey, toast]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const chunks = useMemo(() => estimateChunks(text), [text]);
  const charCount = text.length;

  async function handleGenerate() {
    if (!selectedId) {
      toast("error", "Please create and choose a voice first.");
      return;
    }
    if (!text.trim()) {
      toast("error", "Please enter some text to convert.");
      return;
    }
    setBusy(true);
    setResultUrl("");

    try {
      const gen = await generateSpeech(selectedId, text, selectedVoice?.language || "english", speed);
      const fullUrl = resolveAudioUrl(gen.audio_url);
      setResultUrl(fullUrl);
      const safeName = (gen.voice_name || "speech").replace(/\s+/g, "_");
      setResultName(`${safeName}.mp3`);

      const item: GenerationHistoryItem = {
        id: gen.id,
        voiceId: gen.voice_id,
        voiceName: gen.voice_name || "Unknown voice",
        textPreview: text.slice(0, 120),
        fullText: text,
        speed,
        createdAt: Date.now(),
        audioUrl: fullUrl,
      };
      setHistory(addHistory(item));
      toast("success", "Speech generated and saved locally.");
    } catch (err) {
      toast("error", `Could not generate speech: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  function replayHistory(item: GenerationHistoryItem) {
    setResultUrl(item.audioUrl);
    setResultName(`${(item.voiceName || "speech").replace(/\s+/g, "_")}.mp3`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function loadFromHistory(item: GenerationHistoryItem) {
    setText(item.fullText);
    setSpeed(item.speed);
    if (item.voiceId && voices.some((v) => v.id === item.voiceId)) setSelectedId(item.voiceId);
    toast("info", "Loaded text and settings. Press Generate to recreate.");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">Generate Speech</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Choose a voice, paste your text, and turn it into spoken audio — generated locally.
        </p>
      </header>

      {/* Voice selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-zinc-300">Voice</label>
        <div className="mt-2 flex gap-2">
          <div className="relative flex-1">
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              disabled={loadingVoices}
              className="w-full appearance-none rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-2.5 pr-10 text-sm text-zinc-100 focus:border-sky-500/60 focus:outline-none focus:ring-2 focus:ring-sky-500/20 disabled:opacity-50"
            >
              {loadingVoices && <option>Loading voices…</option>}
              {!loadingVoices && voices.length === 0 && (
                <option value="">No voices yet — create one first</option>
              )}
              {voices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.language})
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          </div>
        </div>
      </div>

      {/* Text input */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <label htmlFor="text" className="block text-sm font-medium text-zinc-300">
            Text
          </label>
          <span className={`text-xs ${charCount > MAX_CHARS ? "text-rose-400" : "text-zinc-500"}`}>
            {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()} chars
            {chunks > 1 && ` · ~${chunks} chunks`}
          </span>
        </div>
        <textarea
          id="text"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
          placeholder="Paste a story, article, or any text you want spoken aloud…"
          rows={10}
          className="mt-2 w-full resize-y rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:border-sky-500/60 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
        />
      </div>

      {/* Speed slider */}
      <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-zinc-300">Speed</label>
          <span className="font-mono text-sm tabular-nums text-sky-400">{speed.toFixed(2)}x</span>
        </div>
        <input
          type="range"
          min={0.7}
          max={1.2}
          step={0.01}
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          className="mt-3 w-full"
        />
        <div className="mt-1 flex justify-between text-xs text-zinc-600">
          <span>0.7x</span>
          <span>1.2x</span>
        </div>
      </div>

      {/* Generate */}
      <Button onClick={handleGenerate} disabled={busy || !selectedId || !text.trim()} loading={busy} className="w-full">
        {busy ? (
          chunks > 1 ? `Generating ${chunks} chunks…` : "Generating speech…"
        ) : (
          <>
            <Wand2 className="h-4 w-4" />
            Generate speech
          </>
        )}
      </Button>

      {/* Progress indicator */}
      {busy && (
        <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-sky-500" />
          </div>
          <span>Processing locally…</span>
        </div>
      )}

      {/* Result */}
      {resultUrl && (
        <div className="mt-6 animate-fade-in-up">
          <h3 className="mb-2 text-sm font-medium text-zinc-300">Result</h3>
          <AudioPlayer src={resultUrl} filename={resultName} />
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="mt-10">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            <History className="h-4 w-4" />
            Recent generations
          </h2>
          <div className="mt-3 space-y-2">
            {history.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-zinc-200">{item.textPreview}</p>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">
                    {item.voiceName} · {item.speed.toFixed(2)}x ·{" "}
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => replayHistory(item)}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 text-xs text-zinc-200 hover:bg-zinc-700"
                  title="Replay"
                >
                  <Play className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Replay</span>
                </button>
                <button
                  onClick={() => loadFromHistory(item)}
                  className="flex h-8 items-center rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 text-xs text-zinc-200 hover:bg-zinc-700"
                  title="Load text & settings"
                >
                  <Wand2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
