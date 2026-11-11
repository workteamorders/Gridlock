'use client';

import { Button } from './Button';
import { Icon } from './Icon';

export function Stepper({ value, min, max, onChange, labelledBy, disabled = false }: { value: number; min: number; max: number; onChange: (n: number) => void; labelledBy: string; disabled?: boolean }) {
  return (
    <div className="stepper" role="group" aria-labelledby={labelledBy}>
      <Button variant="secondary" iconOnly aria-label="One fewer" disabled={disabled || value <= min} onClick={() => onChange(value - 1)}><Icon name="minus" /></Button>
      <output className="num" aria-live="polite">{value}</output>
      <Button variant="secondary" iconOnly aria-label="One more" disabled={disabled || value >= max} onClick={() => onChange(value + 1)}><Icon name="plus" /></Button>
    </div>
  );
}
