import type { SVGProps } from 'react';

const PATHS = {
  check: 'M4 12.5 9.5 18 20 6.5',
  x: 'M5 5l14 14M19 5 5 19',
  alert: 'M12 3 2.5 20h19L12 3ZM12 10v5M12 17.5v.5',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 11v6M12 7.5v.5',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7v5l3.5 2',
  arrowRight: 'M4 12h15M13 6l6 6-6 6',
  arrowLeft: 'M20 12H5M11 6l-6 6 6 6',
  menu: 'M4 6h16M4 12h16M4 18h16',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  refresh: 'M20 12a8 8 0 1 1-2.5-5.8M20 4v5h-5',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  wallet: 'M3 7h17v13H3zM3 7l13-3v3M16 13.5h2',
  detour: 'M5 20V9a4 4 0 0 1 4-4h6M11 1l4 4-4 4M19 20V13',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  label?: string;
}

export function Icon({ name, label, ...rest }: IconProps) {
  const labelled = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };
  return (
    <svg className="icon" viewBox="0 0 24 24" {...labelled} {...rest}>
      <path d={PATHS[name]} />
    </svg>
  );
}
