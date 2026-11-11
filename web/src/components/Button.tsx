import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
  loading?: boolean;
  forceState?: 'hover' | 'focus' | 'active';
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  iconOnly = false,
  loading = false,
  forceState,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  const cls = [
    'btn',
    variant !== 'primary' ? `btn--${variant}` : '',
    size !== 'md' ? `btn--${size}` : '',
    iconOnly ? 'btn--icon' : '',
    forceState ? `is-${forceState}` : '',
    className ?? '',
  ].filter(Boolean).join(' ');
  return (
    <button type={type} className={cls} disabled={disabled} aria-busy={loading || undefined} {...rest}>
      <span className="btn-label">{children}</span>
      <span className="spinner" aria-hidden="true" />
      {loading ? <span className="sr-only">Loading</span> : null}
    </button>
  );
}
