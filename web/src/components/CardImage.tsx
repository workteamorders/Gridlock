import { CardTilt } from './fx/CardTilt';

/** A card picture from the renderer. `priority` is for a picture that is on screen at first paint, so it is loaded at once instead of lazily. `src` is always a data URI produced by the contract and used only as an image source. */
export function CardImage({ src, alt, example = false, size = 300, priority = false }: { src: string | null; alt: string; example?: boolean; size?: number; priority?: boolean }) {
  return (
    <figure className="cardimg">
      {example ? <span className="badge badge--example">Example</span> : null}
      <CardTilt>{src ? <img src={src} alt={alt} width={size} height={Math.round((size * 420) / 300)} loading={priority ? 'eager' : 'lazy'} {...(priority ? { fetchPriority: 'high' as const } : {})} decoding="async" /> : <div className="skeleton cardimg-ph" role="img" aria-label="Loading card" />}</CardTilt>
    </figure>
  );
}
