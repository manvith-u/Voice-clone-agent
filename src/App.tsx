// VoiceClone Studio — fully local voice cloning & text-to-speech.
// React frontend → FastAPI backend → Pocket TTS → local SQLite + filesystem.

import { useState } from "react";
import { Mic, Wand2, Users, AudioLines, HardDrive } from "lucide-react";
import { ToastProvider } from "@/components/Toast";
import { CreateVoicePage } from "@/pages/CreateVoicePage";
import { GenerateSpeechPage } from "@/pages/GenerateSpeechPage";
import { MyVoicesPage } from "@/pages/MyVoicesPage";

type Page = "create" | "generate" | "voices";

const NAV: { id: Page; label: string; icon: typeof Mic }[] = [
  { id: "create", label: "Create a Voice", icon: Mic },
  { id: "generate", label: "Generate Speech", icon: Wand2 },
  { id: "voices", label: "My Voices", icon: Users },
];

function App() {
  const [page, setPage] = useState<Page>("create");
  // Bumped when voices are created/deleted/restored so other pages refetch.
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = () => setRefreshKey((k) => k + 1);

  return (
    <ToastProvider>
      <div className="min-h-screen flex flex-col bg-[#0a0a0f]">
        {/* Header / nav */}
        <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-[#0a0a0f]/90 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/15">
                <AudioLines className="h-5 w-5 text-sky-400" />
              </div>
              <span className="text-sm font-semibold tracking-tight text-zinc-100 sm:text-base">
                VoiceClone Studio
              </span>
            </div>

            <nav className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/60 p-1">
              {NAV.map((item) => {
                const Icon = item.icon;
                const active = page === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setPage(item.id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm ${
                      active ? "bg-sky-500 text-white" : "text-zinc-400 hover:text-zinc-200"
                    }`}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 py-8 sm:py-10">
          {page === "create" && <CreateVoicePage onCreated={bump} />}
          {page === "generate" && <GenerateSpeechPage refreshKey={refreshKey} />}
          {page === "voices" && <MyVoicesPage refreshKey={refreshKey} onChanged={bump} />}
        </main>

        {/* Footer */}
        <footer className="border-t border-zinc-800/80 px-4 py-5">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-1 text-center">
            <p className="flex items-center gap-1.5 text-xs text-zinc-400">
              <HardDrive className="h-3.5 w-3.5 text-emerald-500" />
              Your recordings, voice profiles, and generated audio are stored locally on your computer.
            </p>
            <p className="text-xs text-zinc-500">
              Only clone voices you own or have permission to use.
            </p>
          </div>
        </footer>
      </div>
    </ToastProvider>
  );
}

export default App;
