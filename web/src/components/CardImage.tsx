/** A card picture from the renderer. `src` is always a data URI produced by the contract and used only as an image source. */
export function CardImage({ src, alt, example = false, size = 300 }: { src: string | null; alt: string; example?: boolean; size?: number }) {
  return (
    <figure className="cardimg">
      {example ? <span className="badge badge--example">Example</span> : null}
      {src ? <img src={src} alt={alt} width={size} height={Math.round((size * 420) / 300)} loading="lazy" decoding="async" /> : <div className="skeleton cardimg-ph" role="img" aria-label="Loading card" />}
    </figure>
  );
}
