import type { ReactNode } from 'react';
import { Icon } from './Icon';

interface SignProps {
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}

function SignFrame({ kind, title, children, actions, shape }: SignProps & { kind: string; shape: ReactNode }) {
  return (
    <div className={`sign sign--${kind}`} role="group" aria-label={title}>
      <div className="sign-shape" aria-hidden="true">{shape}</div>
      <div className="sign-body">
        <div className="sign-title">{title}</div>
        {children ? <div className="sign-copy">{children}</div> : null}
        {actions ? <div className="row">{actions}</div> : null}
      </div>
    </div>
  );
}

export function StopSign(props: SignProps) {
  return (
    <SignFrame
      kind="stop"
      {...props}
      shape={
        <svg viewBox="0 0 72 72">
          <polygon points="21,3 51,3 69,21 69,51 51,69 21,69 3,51 3,21" fill="currentColor" stroke="var(--text-on-brush)" strokeWidth="3" />
          <text className="sign-text sign-text--light" x="36" y="42">Stop</text>
        </svg>
      }
    />
  );
}

export function YieldSign(props: SignProps) {
  return (
    <SignFrame
      kind="yield"
      {...props}
      shape={
        <svg viewBox="0 0 72 72">
          <polygon points="36,66 4,10 68,10" fill="currentColor" stroke="var(--text-on-action)" strokeWidth="4" strokeLinejoin="miter" />
          <path d="M36 26v18M36 52v2" stroke="var(--text-on-action)" strokeWidth="5" />
        </svg>
      }
    />
  );
}

export function DeadEnd(props: SignProps) {
  return (
    <SignFrame
      kind="dead"
      {...props}
      shape={
        <svg viewBox="0 0 72 72">
          <polygon points="36,3 69,36 36,69 3,36" fill="currentColor" stroke="var(--text-on-action)" strokeWidth="3" />
          <path d="M22 28h28M36 28v22" stroke="var(--text-on-action)" strokeWidth="6" />
        </svg>
      }
    />
  );
}

export function Detour(props: SignProps) {
  return (
    <SignFrame
      kind="detour"
      {...props}
      shape={
        <svg viewBox="0 0 72 72">
          <rect x="4" y="12" width="64" height="48" fill="currentColor" stroke="var(--text-on-action)" strokeWidth="3" />
          <path d="M18 46V32a6 6 0 0 1 6-6h24M42 18l8 8-8 8" fill="none" stroke="var(--text-on-action)" strokeWidth="5" />
        </svg>
      }
    />
  );
}

export function SpeedLimit({ max, label = 'Max per wallet' }: { max: number; label?: string }) {
  return (
    <div className="speed" role="img" aria-label={`${label}: ${max}`}>
      <b>{max}</b>
      <span>{label}</span>
    </div>
  );
}

export interface TollRow { label: string; value: string }

export function TollGate({ title = 'Toll gate', rows, total, notes, example = false }: { title?: string; rows: TollRow[]; total: TollRow; notes: string[]; example?: boolean }) {
  return (
    <section className="toll" aria-label={title}>
      <div className="toll-head">
        <h3>{title}</h3>
        {example ? <span className="badge badge--example">Example</span> : null}
      </div>
      <dl>
        {rows.map((r) => (
          <div key={r.label} className="toll-row">
            <dt>{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
        <div className="toll-row total">
          <dt>{total.label}</dt>
          <dd>{total.value}</dd>
        </div>
      </dl>
      <ul>
        {notes.map((n) => (
          <li key={n}><Icon name="check" /><span>{n}</span></li>
        ))}
      </ul>
    </section>
  );
}
