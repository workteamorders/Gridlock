import { useId, type ReactNode } from 'react';

/** Hover and focus tooltip. The same fact must also live in nearby text; a tooltip is never the only place. */
export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <span className="tip" aria-describedby={id}>
      {children}
      <span role="tooltip" id={id}>{label}</span>
    </span>
  );
}
