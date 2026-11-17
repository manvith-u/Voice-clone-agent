// Page 3: My Voices.
// Lists locally stored voice profiles with delete (confirmed). Also provides
// backup export and restore controls.

import { useEffect, useRef, useState } from "react";
import { Trash2, Mic2, RefreshCw, Download, Upload, Database } from "lucide-react";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { deleteVoice, exportBackup, listVoices, restoreBackup } from "@/lib/api";
import type { Voice } from "@/lib/types";

export function MyVoicesPage({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const { toast } = useToast();
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<Voice | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [backing, setBacking] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const restoreInputRef = useRef<HTMLInputElement | null>(null);

  function reload() {
    setLoading(true);
    listVoices()
      .then(setVoices)
      .catch((err) => toast("error", `Could not load voices: ${(err as Error).message}`))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    listVoices()
      .then((v) => active && setVoices(v))
      .catch((err) => toast("error", `Could not load voices: ${(err as Error).message}`))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [refreshKey, toast]);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteVoice(pendingDelete.id);
      setVoices((prev) => prev.filter((v) => v.id !== pendingDelete.id));
      toast("success", `Deleted "${pendingDelete.name}" and its local files.`);
      setPendingDelete(null);
      onChanged();
    } catch (err) {
      toast("error", `Could not delete voice: ${(err as Error).message}`);
    } finally {
      setDeleting(false);
    }
  }

  async function handleExport() {
    setBacking(true);
    try {
      const result = await exportBackup();
      // Trigger download of the backup zip.
      const a = document.createElement("a");
      a.href = `http://127.0.0.1:8000/backup/download`;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast("success", "Backup created. Download started.");
    } catch (err) {
      toast("error", `Backup failed: ${(err as Error).message}`);
    } finally {
      setBacking(false);
    }
  }

  async function handleRestoreFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoring(true);
    try {
      const msg = await restoreBackup(file);
      toast("success", msg);
      reload();
      onChanged();
    } catch (err) {
      toast("error", `Restore failed: ${(err as Error).message}`);
    } finally {
      setRestoring(false);
      if (restoreInputRef.current) restoreInputRef.current.value = "";
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">My Voices</h1>
          <p className="mt-2 text-sm text-zinc-400">Manage your locally stored voice profiles.</p>
        </div>
        <Button variant="ghost" onClick={reload}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </header>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading voices…</p>
      ) : voices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 p-10 text-center">
          <Mic2 className="mx-auto h-8 w-8 text-zinc-600" />
          <p className="mt-3 text-sm text-zinc-400">No voices yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {voices.map((v) => (
            <VoiceRow key={v.id} voice={v} onDelete={() => setPendingDelete(v)} />
          ))}
        </div>
      )}

      {/* Backup & restore */}
      <section className="mt-10">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          <Database className="h-4 w-4" />
          Backup &amp; Restore
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={handleExport} loading={backing} disabled={voices.length === 0}>
            <Download className="h-4 w-4" />
            Export backup
          </Button>
          <Button variant="secondary" onClick={() => restoreInputRef.current?.click()} loading={restoring}>
            <Upload className="h-4 w-4" />
            Restore from file
          </Button>
          <input
            ref={restoreInputRef}
            type="file"
            accept=".zip,application/zip"
            onChange={handleRestoreFile}
            className="hidden"
          />
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Backups include all voice profiles and the SQLite database. Restoring adds voices that don&apos;t already exist.
        </p>
      </section>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this voice?"
        description={
          <>
            You&apos;re about to permanently delete <strong className="text-zinc-200">{pendingDelete?.name}</strong> and its voice profile from your computer. This cannot be undone.
          </>
        }
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

function VoiceRow({ voice, onDelete }: { voice: Voice; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/15">
        <Mic2 className="h-5 w-5 text-sky-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-100">{voice.name}</p>
        <p className="truncate text-xs text-zinc-500">
          {voice.language} · created {new Date(voice.created_at).toLocaleDateString()}
        </p>
      </div>
      <button
        onClick={onDelete}
        className="flex h-9 items-center justify-center rounded-lg border border-rose-700/50 bg-rose-950/40 px-3 text-xs text-rose-300 hover:bg-rose-900/50"
        title="Delete voice"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
