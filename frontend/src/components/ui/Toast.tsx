import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastCtx {
  push: (kind: ToastKind, message: string) => void;
  success: (m: string) => void;
  error: (m: string) => void;
  info: (m: string) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = ++counter;
      setItems((prev) => [...prev, { id, kind, message }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove],
  );

  const api: ToastCtx = {
    push,
    success: (m) => push('success', m),
    error: (m) => push('error', m),
    info: (m) => push('info', m),
  };

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {items.map((t) => (
          <ToastItemView key={t.id} item={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function ToastItemView({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setOpen(false), 3600);
    return () => clearTimeout(t);
  }, []);

  const Icon =
    item.kind === 'success' ? CheckCircle2 : item.kind === 'error' ? AlertCircle : Info;
  const accent =
    item.kind === 'success'
      ? 'text-moss'
      : item.kind === 'error'
        ? 'text-oxblood'
        : 'text-amber';

  return (
    <div
      className={cn(
        'pointer-events-auto bg-surface border border-rule-strong rounded-sm shadow-popover',
        'px-3.5 py-2.5 flex items-start gap-2.5 transition-all duration-120',
        open ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1',
      )}
      role="status"
    >
      <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', accent)} />
      <div className="text-sm text-ink flex-1 min-w-0 break-words">{item.message}</div>
      <button
        onClick={onClose}
        className="text-ink-3 hover:text-ink transition-colors"
        aria-label="close"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
