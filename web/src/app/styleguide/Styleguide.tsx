'use client';

import { MotionButton } from '@/components/fx/Motion';
import { ResultStamp } from '@/components/fx/ResultStamp';
import { StatusArt } from '@/components/fx/StatusArt';
import { CardTilt } from '@/components/fx/CardTilt';
import { CardImage } from '@/components/CardImage';
import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { CardArt } from '@/components/CardArt';
import { Countdown } from '@/components/Countdown';
import { Dialog } from '@/components/Dialog';
import { Field } from '@/components/Field';
import { HeatStars } from '@/components/HeatStars';
import { Icon } from '@/components/Icon';
import { Ladder } from '@/components/Ladder';
import { Shell } from '@/components/Shell';
import { DeadEnd, Detour, SpeedLimit, StopSign, TollGate, YieldSign } from '@/components/Signs';
import { SupplyChart } from '@/components/SupplyChart';
import { useToast } from '@/components/Toast';
import { Tooltip } from '@/components/Tooltip';
import { exampleLadder, type RungData } from '@/lib/mock';
import './styleguide.css';

const COLORS = [
  ['--surface', 'Base surface'], ['--surface-2', 'Second surface'], ['--surface-3', 'Third surface'],
  ['--text', 'Text'], ['--text-dim', 'Dim text'], ['--action', 'Action (primary)'],
  ['--brush', 'Brush (slash)'], ['--brush-deep', 'Brush deep'], ['--ok', 'Status ok'],
  ['--warn', 'Status warn'], ['--bad', 'Status bad'], ['--info', 'Status info'],
] as const;

const PAIRS = [
  ['--text', '--surface', 'Body text on base'],
  ['--text', '--surface-2', 'Body text on panel'],
  ['--text-dim', '--surface', 'Dim text on base'],
  ['--text-dim', '--surface-2', 'Dim text on panel'],
  ['--text-on-action', '--action', 'Text on action'],
  ['--text-on-brush', '--brush', 'White on brush'],
  ['--text-on-brush', '--brush-deep', 'White on brush deep'],
  ['--action', '--surface', 'Action as text or border on base'],
  ['--brush', '--surface', 'Brush on base (large text and strokes only)'],
  ['--bad', '--surface', 'Status bad text'],
  ['--ok', '--surface', 'Status ok text'],
  ['--info', '--surface', 'Status info text'],
  ['--focus', '--surface', 'Focus ring on base'],
  ['--line-dim', '--surface', 'Dim border on base (needs 3:1)'],
] as const;

function parse(rgb: string): [number, number, number] {
  const m = rgb.match(/[\d.]+/g);
  if (!m || m.length < 3) return [0, 0, 0];
  return [Number(m[0]), Number(m[1]), Number(m[2])];
}
function lum([r, g, b]: [number, number, number]) {
  const f = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function ratio(a: string, b: string) {
  const la = lum(parse(a)), lb = lum(parse(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function useTokenValues(names: readonly string[]) {
  const [vals, setVals] = useState<Record<string, string>>({});
  useEffect(() => {
    const probe = document.createElement('span');
    document.body.appendChild(probe);
    const out: Record<string, string> = {};
    for (const n of names) {
      probe.style.color = `var(${n})`;
      out[n] = getComputedStyle(probe).color;
    }
    probe.remove();
    setVals(out);
  }, [names]);
  return vals;
}

const ALL_TOKENS = Array.from(new Set([...COLORS.map((c) => c[0]), ...PAIRS.flatMap((p) => [p[0], p[1]])]));

function toHex(rgb: string) {
  const [r, g, b] = parse(rgb);
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

function ForcedButtons({ variant }: { variant: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  return (
    <div className="state-grid">
      <figure><Button variant={variant}>Default</Button><figcaption>Default</figcaption></figure>
      <figure><Button variant={variant} forceState="hover">Hover</Button><figcaption>Hover</figcaption></figure>
      <figure><Button variant={variant} forceState="focus">Focus</Button><figcaption>Keyboard focus</figcaption></figure>
      <figure><Button variant={variant} forceState="active">Pressed</Button><figcaption>Pressed</figcaption></figure>
      <figure><Button variant={variant} disabled>Disabled</Button><figcaption>Disabled</figcaption></figure>
      <figure><Button variant={variant} loading>Loading</Button><figcaption>Loading, same width</figcaption></figure>
    </div>
  );
}

export function Styleguide() {
  const vals = useTokenValues(ALL_TOKENS);
  const toast = useToast();
  const [dlg, setDlg] = useState<'none' | 'confirm' | 'sheet'>('none');
  const [qty, setQty] = useState(1);
  const [sw, setSw] = useState(false);
  const [name, setName] = useState('');
  const [nameErr, setNameErr] = useState('');
  const ladder: RungData[] = exampleLadder();
  const target = 1_790_000_000;

  return (
    <Shell>
        <div className="wrap section sg-intro">
          <div className="stack">
            <span className="badge badge--example">Internal page</span>
            <h1>Styleguide</h1>
            <p>
              Direction A, poster wall. Every value comes from <code>tokens.css</code>. All numbers, prices, and cards
              on this page are labeled <strong>Example</strong>; the art is a mock, not renderer output.
            </p>
            <div className="slash-rule" aria-hidden="true" />
            <nav aria-label="On this page" className="row">
              {['colors', 'type', 'shape', 'buttons', 'forms', 'panels', 'overlays', 'data', 'status', 'signs', 'ladder', 'cards', 'live'].map((s) => (
                <a key={s} className="chip" href={`#${s}`}>{s}</a>
              ))}
            </nav>
          </div>
        </div>

        <section id="colors" className="wrap section">
          <div className="stack">
            <h2>Colors</h2>
            <div className="grid">
              {COLORS.map(([tok, role]) => (
                <div className="swatch" key={tok}>
                  <i className={`sw sw${tok.replace('--', '-')}`} />
                  <div><strong>{role}</strong><code>{tok} {vals[tok] ? toHex(vals[tok]) : ''}</code></div>
                </div>
              ))}
            </div>
            <h3>Contrast, computed live from the tokens</h3>
            <div className="table-wrap">
              <table className="table">
                <caption>WCAG AA needs 4.5 for normal text and 3 for large text and component borders</caption>
                <thead><tr><th scope="col">Pair</th><th scope="col" className="num">Ratio</th><th scope="col">Result</th></tr></thead>
                <tbody>
                  {PAIRS.map(([fg, bg, label]) => {
                    const r = vals[fg] && vals[bg] ? ratio(vals[fg], vals[bg]) : 0;
                    const large = label.includes('large') || label.includes('needs 3:1') || label.includes('Focus');
                    const need = large ? 3 : 4.5;
                    const ok = r >= need;
                    return (
                      <tr key={label}>
                        <td data-label="Pair">{label}</td>
                        <td data-label="Ratio" className="num">{r ? r.toFixed(2) : '...'}</td>
                        <td data-label="Result">
                          <span className={`badge ${ok ? 'badge--ok' : 'badge--bad'}`}><Icon name={ok ? 'check' : 'x'} />{ok ? `Pass ${need}:1` : `Fail ${need}:1`}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section id="type" className="wrap section">
          <div className="stack">
            <h2>Type</h2>
            <p className="dim">Anton for display, Barlow for text, Space Mono for numbers. All three are SIL OFL 1.1 and self-hosted.</p>
            <div className="stack-tight">
              {[['--fs-60', 'Rank 15 sold out', 'display'], ['--fs-44', 'Mint at the open rung', 'display'], ['--fs-32', 'Heat is only a picture', 'display'], ['--fs-24', 'Payment must be exact', 'display'], ['--fs-20', 'No refunds. You see the card first.', 'body'], ['--fs-16', 'Body text is 16px with a 1.55 line height and a 70 character measure.', 'body'], ['--fs-14', 'Helper text, table cells, and meta.', 'body'], ['--fs-12', 'Label text, capitals with tracking', 'label']].map(([tok, text, kind]) => (
                <div key={tok} className="sg-type">
                  <code className="dim">{tok?.replace('--fs-', '')}px</code>
                  <span className={`sg-type-${tok?.replace('--', '')} ${kind === 'label' ? 'label' : ''} ${kind === 'display' ? 'sg-display' : ''}`}>{text}</span>
                </div>
              ))}
              <div className="sg-type"><code className="dim">mono</code><span className="mono">0.0042 ETH x 2 = 0.0084 ETH</span></div>
            </div>
          </div>
        </section>

        <section id="shape" className="wrap section">
          <div className="stack">
            <h2>Shape, elevation, motion</h2>
            <div className="grid">
              <div className="panel"><h4>Flat</h4><p className="dim">Second surface, dim outline.</p></div>
              <div className="panel panel--raised"><h4>Raised</h4><p className="dim">Second surface, 3px ink outline.</p></div>
              <div className="panel sg-float"><h4>Floating</h4><p className="dim">Third surface, yellow outline. Dialogs and toasts.</p></div>
            </div>
            <div className="grid">
              <div className="stack-tight"><span className="label">Spacing, multiples of 4</span><div className="sg-spacing" aria-hidden="true">{['s-1', 's-2', 's-3', 's-4', 's-5', 's-6', 's-7', 's-8'].map((s) => <i key={s} className={`sg-sp sg-${s}`} />)}</div><code className="dim">4 8 12 16 24 32 48 64</code></div>
              <div className="stack-tight"><span className="label">Motif, the brush slash</span><div className="slash-rule" aria-hidden="true" /><p className="dim">Used on the brand mark, sold rungs, headings rule, and rank 1.</p></div>
              <div className="stack-tight"><span className="label">Hazard strip</span><div className="hazard" aria-hidden="true" /><p className="dim">Only on warning surfaces.</p></div>
            </div>
            <p className="dim">Motion has one character, a firm quick ease-out with no bounce. Micro 100ms, elements 200ms, panels 320ms. Only transform and opacity animate. Reduced motion turns it all off.</p>
          </div>
        </section>

        <section id="buttons" className="wrap section">
          <div className="stack">
            <h2>Buttons</h2>
            {(['primary', 'secondary', 'ghost', 'danger'] as const).map((v) => (
              <div className="stack-tight" key={v}><h4>{v}</h4><ForcedButtons variant={v} /></div>
            ))}
            <div className="row">
              <Button size="sm">Small</Button><Button>Medium</Button><Button size="lg">Large</Button>
              <Button variant="secondary" iconOnly aria-label="Refresh"><Icon name="refresh" /></Button>
              <Button><Icon name="wallet" />Connect wallet</Button>
            </div>
          </div>
        </section>

        <section id="forms" className="wrap section">
          <div className="stack">
            <h2>Forms</h2>
            <div className="grid sg-forms">
              <Field id="f-default" label="Car name filter" placeholder="GR-09" help="Plates look like GR-09. Example text only." />
              <Field id="f-focus" label="Focused" defaultValue="GR-09" forceFocus />
              <Field id="f-err" label="Quantity" defaultValue="3" error="Pick 1 to 2 cards per rank." />
              <Field id="f-dis" label="Disabled" defaultValue="Locked until rank 12 opens" disabled />
              <div className="field">
                <label htmlFor="f-live">Validates on blur</label>
                <input id="f-live" className="input" value={name} placeholder="Type a plate, then tab away" aria-invalid={nameErr ? true : undefined} aria-describedby="f-live-err"
                  onChange={(e) => { setName(e.target.value); setNameErr(''); }}
                  onBlur={() => setNameErr(name && !/^[A-Z]{2}-\d{2}$/.test(name) ? 'Use two capital letters, a dash, and two digits, like GR-09.' : '')} />
                <span id="f-live-err" className="error-text" role="alert" hidden={!nameErr}><Icon name="alert" /><span>{nameErr}</span></span>
              </div>
              <div className="field">
                <label htmlFor="f-sel">Rank filter</label>
                <select id="f-sel" className="select" defaultValue="all"><option value="all">All ranks</option><option value="15">Rank 15</option><option value="1">Rank 1</option></select>
              </div>
              <fieldset className="field sg-fieldset">
                <legend className="label">Choices</legend>
                <label className="choice"><input type="checkbox" defaultChecked />Show heat stars</label>
                <label className="choice"><input type="checkbox" />Show hidden cars</label>
                <label className="choice"><input type="checkbox" disabled />Disabled choice</label>
                <label className="choice"><input type="radio" name="r" defaultChecked />Newest first</label>
                <label className="choice"><input type="radio" name="r" />Rank first</label>
              </fieldset>
              <div className="stack-tight">
                <label className="switch"><input type="checkbox" role="switch" checked={sw} onChange={(e) => setSw(e.target.checked)} /><span>Sound</span><span className="state-word">{sw ? 'On' : 'Off'}</span></label>
                <div className="field"><span className="label" id="qty-l">Quantity (max 2 per rank)</span>
                  <div className="stepper" role="group" aria-labelledby="qty-l">
                    <button type="button" aria-label="Fewer cards" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1}><Icon name="minus" /></button>
                    <output aria-live="polite">{qty}</output>
                    <button type="button" aria-label="More cards" onClick={() => setQty((q) => Math.min(2, q + 1))} disabled={qty >= 2}><Icon name="plus" /></button>
                  </div>
                </div>
                <div className="field"><label htmlFor="rg">Range (preview only)</label><input id="rg" type="range" min={1} max={15} defaultValue={13} /></div>
                <div className="file"><Icon name="upload" /><span className="dim">File upload is not used by Gridlock. Shown for the system.</span></div>
              </div>
            </div>
          </div>
        </section>

        <section id="panels" className="wrap section">
          <div className="stack">
            <h2>Panels, badges, chips</h2>
            <div className="grid">
              <div className="panel"><h4>Static panel</h4><p className="dim">Not clickable.</p></div>
              <div className="panel panel--link"><h4>Interactive panel</h4><p className="dim">One target, one link.</p><a href="#panels">Open the gallery</a></div>
            </div>
            <div className="row">
              <span className="badge badge--ok"><Icon name="check" />Open</span>
              <span className="badge badge--warn"><Icon name="clock" />Opens soon</span>
              <span className="badge badge--bad"><Icon name="x" />Sold out</span>
              <span className="badge badge--info"><Icon name="info" />Info</span>
              <span className="badge badge--solid">Rank 1</span>
              <span className="badge badge--example">Example</span>
              <button type="button" className="chip" aria-pressed="true">Rank 15</button>
              <button type="button" className="chip" aria-pressed="false">Rank 14</button>
            </div>
          </div>
        </section>

        <section id="overlays" className="wrap section">
          <div className="stack">
            <h2>Navigation, dialogs, toasts</h2>
            <p className="dim">The header above is the live nav. On a phone the menu opens a drawer; open it with the Menu button.</p>
            <div className="row">
              <Button onClick={() => setDlg('confirm')}>Open confirm dialog</Button>
              <Button variant="secondary" onClick={() => setDlg('sheet')}>Open bottom sheet (phones)</Button>
              <Button variant="secondary" onClick={() => toast.push({ kind: 'ok', title: 'Card sent', text: 'Example toast. It closes by itself after five seconds.' })}>Success toast</Button>
              <Button variant="secondary" onClick={() => toast.push({ kind: 'bad', title: 'Mint failed', text: 'Example. Your funds did not move. Try again.' })}>Error toast</Button>
              <Tooltip label="Heat is a picture of recent moves. It changes nothing else."><Button variant="ghost">What is heat?</Button></Tooltip>
            </div>
            <Dialog open={dlg === 'confirm'} onClose={() => setDlg('none')} title="Send this car?"
              actions={<><Button variant="secondary" onClick={() => setDlg('none')}>Keep the car</Button><Button variant="danger" onClick={() => setDlg('none')}>Send car</Button></>}>
              <StopSign title="This cannot be undone">Sending moves the card to the new owner at once and adds 20 heat. Heat changes no price or rule.</StopSign>
            </Dialog>
            <Dialog open={dlg === 'sheet'} onClose={() => setDlg('none')} title="Bottom sheet" variant="sheet"
              actions={<Button onClick={() => setDlg('none')}>Got it</Button>}>
              <p>On phones a dialog sits at the bottom and spans the screen width.</p>
            </Dialog>
          </div>
        </section>

        <section id="data" className="wrap section">
          <div className="stack">
            <h2>Tables and charts</h2>
            <div className="table-wrap">
              <table className="table">
                <caption>Rungs <span className="badge badge--example">Example</span></caption>
                <thead><tr><th scope="col">Rank</th><th scope="col">Status</th><th scope="col" className="num">Sold</th><th scope="col" className="num">Cap</th><th scope="col" className="num">Price</th></tr></thead>
                <tbody>
                  {ladder.filter((r) => r.rank >= 11).map((r) => (
                    <tr key={r.rank}>
                      <td data-label="Rank">{r.rank}</td><td data-label="Status">{r.status}</td>
                      <td data-label="Sold" className="num">{r.sold}</td><td data-label="Cap" className="num">{r.cap}</td><td data-label="Price" className="num">{r.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <SupplyChart />
          </div>
        </section>

        <section id="status" className="wrap section">
          <div className="stack">
            <h2>System status</h2>
            <div className="grid">
              <div className="stack-tight" aria-busy="true"><span className="label">Skeleton, shaped like a rung</span><div className="skeleton sg-sk-rung" /><div className="skeleton sg-sk-line" /></div>
              <div className="empty"><Icon name="wallet" /><div className="stack-tight"><h4>Your garage is empty</h4><p className="dim">Cars you mint or receive show up here.</p><Button size="sm">Mint at the open rung</Button></div></div>
            </div>
            <div className="alert alert--bad" role="alert">
              <Icon name="alert" />
              <div>
                <h4>The RPC did not answer</h4>
                <p>Nothing was sent, so your funds and cards are safe. The page is showing the last data it had.</p>
                <ul><li>Retry now, or wait a minute and the page retries by itself.</li><li>Your wallet still works. You can check the contract on the explorer.</li></ul>
                <div className="row sg-mt"><Button size="sm"><Icon name="refresh" />Retry</Button><Button size="sm" variant="secondary">Open the explorer</Button></div>
              </div>
            </div>
            <div className="alert alert--warn"><Icon name="alert" /><div><h4>TEST CLOCK</h4><p>This site is pointed at a deployment with short timers. Do not treat times here as production.</p></div></div>
          </div>
        </section>

        <section id="signs" className="wrap section">
          <div className="stack">
            <h2>Signs</h2>
            <p className="dim">Each sign pairs a shape with a word and an icon. None rely on color.</p>
            <div className="grid sg-signs">
              <div className="panel"><StopSign title="Permanent action">Minting is final. There is no refund and no undo.</StopSign></div>
              <div className="panel"><YieldSign title="Heads up">Sending a car adds heat. Heat changes nothing else.</YieldSign></div>
              <div className="panel"><DeadEnd title="Dead end">This page does not exist. Go back to the ladder.</DeadEnd></div>
              <div className="panel"><Detour title="Detour" actions={<Button size="sm" variant="secondary">Use another RPC</Button>}>The main RPC is slow. Try the backup.</Detour></div>
              <div className="panel row"><SpeedLimit max={2} label="Max per wallet" /><p className="dim">Quantity limit for this rank. Also shown in words.</p></div>
            </div>
            <TollGate
              example
              title="Toll gate"
              rows={[{ label: 'Cards', value: '2' }, { label: 'Rank', value: '13' }, { label: 'Price each', value: '0.0050 ETH' }, { label: 'Network fee', value: 'Set by your wallet' }]}
              total={{ label: 'You pay', value: '0.0100 ETH' }}
              notes={['100% of the sale goes to the announced treasury.', 'Payment must be exact. There are no refunds.', 'You see the exact card before you sign.', 'Heat changes no price, rule, or right.']}
            />
          </div>
        </section>

        <section id="ladder" className="wrap section">
          <div className="stack">
            <h2>Ladder, every state</h2>
            <p>Live progress follows confirmed chain reads. An open rank stamps once when it changes state.</p>
            <div className="row"><span className="badge badge--example">Example data</span><span className="dim">Rank 15 and 14 sold out, 13 open, 12 waits for 13 or a timeout, 11 has a set time, the rest are locked.</span></div>
            <div className="panel stack">
              <span className="label">Before the start time</span>
              <Countdown target={target} frozenNow={target - 187_265} label="Time until rank 15 opens" />
            </div>
            <Ladder rungs={ladder} ctaFor={(r) => (r.status === 'open' ? <Button size="lg">Mint rank {r.rank}</Button> : null)} />
            <div className="panel stack-tight">
              <h4>After everything sells out</h4>
              <p>The ladder shows the final result: 2,475 ladder cards sold, 12 hidden cars claimed or waiting. Example text, no live data.</p>
            </div>
          </div>
        </section>

        <section id="cards" className="wrap section">
          <div className="stack">
            <h2>Cards and heat</h2>
            <p className="dim">The three card kinds below are a mock for the styleguide. The real art comes from the renderer contract.</p>
            <div className="grid sg-cards">
              <div className="stack-tight"><a className="card-link" href="#live"><CardTilt><CardArt kind="standard" rank={9} plate="GR-09" shape="hatch" stars={2} transfers={3} peak={2} /></CardTilt></a><span className="label">Standard, rank 9</span></div>
              <div className="stack-tight"><CardArt kind="rank1" rank={1} plate="GR-01" shape="coupe" stars={5} transfers={11} peak={5} /><span className="label">Rank 1</span></div>
              <div className="stack-tight"><CardArt kind="hidden" plate="HT-07" shape="van" stars={0} /><span className="label">Hidden car</span></div>
            </div>
            <h3>Five heat states</h3>
            <div className="grid sg-heat">
              {([1, 2, 3, 4, 5] as const).map((n) => (
                <div className="stack-tight" key={n}>
                  <CardArt kind="standard" rank={9} plate="GR-09" shape="van" stars={n} transfers={n * 3} peak={n} />
                  <HeatStars stars={n} />
                  <span className="dim">Heat {[1, 20, 45, 80, 120][n - 1]} or more</span>
                </div>
              ))}
            </div>
            <div className="alert alert--info"><Icon name="info" /><p>Heat is a picture of recent moves. It does not change price, rules, or rights, and it drains by 1 point each hour.</p></div>
          </div>
        </section>
      <section id="live" className="wrap section stack" aria-labelledby="sg-live">
        <h2 id="sg-live">Live effects</h2>
        <p>Move or drag to reveal halftone and redirect traffic. Tap to place a cone. Hover a card to tilt it. Use Tab to focus a card link. Cycle Motion to compare Full, Reduced and Off.</p>
        <MotionButton />
        <div className="hazard-tape" aria-hidden="true" />
        <div className="row">
          <CardImage src={null} alt="Loading card" size={120} />
          <StatusArt kind="empty" /><StatusArt kind="offline" /><StatusArt kind="error" />
        </div>
        <div className="panel stack">
          <span className="badge badge--example">Example</span>
          <ResultStamp kind="caught" /><ResultStamp kind="claimed" />
        </div>
        <p>Open <code>?motion=off</code> to lock Motion and hide the background.</p>
      </section>
    </Shell>
  );
}
