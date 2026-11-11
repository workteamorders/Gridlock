'use client';

import type { PointerEvent, ReactNode } from 'react';

function move(event: PointerEvent<HTMLDivElement>) {
  if (document.documentElement.dataset.motion !== 'full' || (event.pointerType === 'touch' && !event.buttons)) return;
  const node = event.currentTarget;
  const box = node.getBoundingClientRect();
  const x = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
  const y = Math.min(1, Math.max(0, (event.clientY - box.top) / box.height));
  node.style.setProperty('--tilt-x', `${(0.5 - y) * 20}deg`);
  node.style.setProperty('--tilt-y', `${(x - 0.5) * 20}deg`);
  node.style.setProperty('--tilt-glint', `${(x - 0.5) * 140}%`);
  node.dataset.tracking = 'true';
}

function reset(event: PointerEvent<HTMLDivElement>) {
  delete event.currentTarget.dataset.tracking;
}

export function CardTilt({ children }: { children: ReactNode }) {
  return (
    <div className="card-tilt" onPointerMove={move} onPointerDown={move} onPointerLeave={reset}
      onPointerCancel={reset} onPointerUp={(event) => { if (event.pointerType === 'touch') reset(event); }}>
      <div className="card-tilt-face">{children}<span className="card-glint" aria-hidden="true" /></div>
    </div>
  );
}
