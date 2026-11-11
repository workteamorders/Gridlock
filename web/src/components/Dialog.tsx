'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  variant?: 'dialog' | 'drawer' | 'sheet';
  closeLabel?: string;
}

/** Native <dialog>: focus moves in, Esc closes, focus returns to the trigger, background is inert. */
export function Dialog({ open, onClose, title, children, actions, variant = 'dialog', closeLabel = 'Close' }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const cls = variant === 'drawer' ? 'drawer' : variant === 'sheet' ? 'sheet' : '';
  return (
    <dialog
      ref={ref}
      className={cls}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
    >
      <div className="dialog-head">
        <h3 id={titleId}>{title}</h3>
        <Button variant="secondary" size="sm" iconOnly onClick={onClose} aria-label={closeLabel}><Icon name="x" /></Button>
      </div>
      <div className="dialog-body">{children}</div>
      {actions ? <div className="dialog-actions">{actions}</div> : null}
    </dialog>
  );
}
