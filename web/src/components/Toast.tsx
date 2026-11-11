'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

type ToastKind = 'ok' | 'bad' | 'info';
interface ToastItem { id: number; kind: ToastKind; title: string; text: string }
interface ToastApi { push: (t: Omit<ToastItem, 'id'>) => void }

const Ctx = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useToast must be used inside ToastProvider');
  return v;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(1);

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const push = useCallback((t: Omit<ToastItem, 'id'>) => {
    const id = next.current++;
    setItems((xs) => [...xs, { ...t, id }]);
    window.setTimeout(() => dismiss(id), 5000);
  }, [dismiss]);
  const api = useMemo(() => ({ push }), [push]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toast-region" role="status" aria-live="polite" aria-atomic="false">
        {items.map((t) => (
          <div key={t.id} className={`toast toast--${t.kind}`}>
            <Icon name={t.kind === 'ok' ? 'check' : t.kind === 'bad' ? 'alert' : 'info'} />
            <div>
              <strong>{t.title}</strong>
              <p>{t.text}</p>
            </div>
            <button type="button" className="btn btn--ghost btn--icon btn--sm" onClick={() => dismiss(t.id)} aria-label="Dismiss notification">
              <Icon name="x" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
