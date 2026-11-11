import type { InputHTMLAttributes, ReactNode } from 'react';
import { Icon } from './Icon';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  help?: string;
  error?: string;
  forceFocus?: boolean;
  suffix?: ReactNode;
}

export function Field({ id, label, help, error, forceFocus, className, ...rest }: FieldProps) {
  const helpId = help ? `${id}-help` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [helpId, errId].filter(Boolean).join(' ') || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className={['input', forceFocus ? 'is-focus' : '', className ?? ''].filter(Boolean).join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      {help ? <span id={helpId} className="help">{help}</span> : null}
      {error ? (
        <span id={errId} className="error-text" role="alert">
          <Icon name="alert" />
          <span>{error}</span>
        </span>
      ) : null}
    </div>
  );
}
