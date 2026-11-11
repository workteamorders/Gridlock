export function StatusArt({ kind }: { kind: 'empty' | 'offline' | 'error' }) {
  return <img className="status-art" src={`/art/${kind}.svg`} alt="" width={160} height={90} />;
}
