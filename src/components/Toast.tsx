// Toast notification system. A single provider keeps a list of toasts and
// auto-dismisses each one after a few seconds. Components call `useToast()`.

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (type: ToastType, message: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, type, message }]);
      // Auto dismiss after 5 seconds (errors stay a bit longer).
      const timeout = type === "error" ? 7000 : 5000;
      window.setTimeout(() => dismiss(id), timeout);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] sm:w-96">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const colors =
    toast.type === "success"
      ? "border-emerald-500/40 bg-emerald-950/80"
      : toast.type === "error"
      ? "border-rose-500/40 bg-rose-950/80"
      : "border-sky-500/40 bg-sky-950/80";

  const Icon =
    toast.type === "success"
      ? CheckCircle2
      : toast.type === "error"
      ? AlertTriangle
      : Info;
  const iconColor =
    toast.type === "success"
      ? "text-emerald-400"
      : toast.type === "error"
      ? "text-rose-400"
      : "text-sky-400";

  return (
    <div
      className={`animate-toast-in flex items-start gap-3 rounded-xl border ${colors} px-4 py-3 shadow-lg backdrop-blur`}
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconColor}`} />
      <p className="flex-1 text-sm leading-snug text-zinc-100">{toast.message}</p>
      <button
        onClick={onDismiss}
        className="shrink-0 text-zinc-400 hover:text-zinc-200 transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
