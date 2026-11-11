import type { Metadata } from 'next';
import { Styleguide } from './Styleguide';

export const metadata: Metadata = {
  title: 'Styleguide | Gridlock',
  description: 'Design tokens, components, and states for Gridlock.',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <Styleguide />;
}
