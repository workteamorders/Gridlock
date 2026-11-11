'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useChain } from '@/lib/chain-context';
import { useWallet } from '@/lib/wallet';
import { readOwned, readPreview, readSvg, readWalletMinted, svgToDataUri } from '@/lib/chain';
import { sendTx, TxError, explainError } from '@/lib/tx';
import { CHAIN, explorerAddress, explorerTx, walletRankCap } from '@/lib/config';
import { formatEth, shortAddress } from '@/lib/format';
import { checkQuantity } from '@/lib/validation';
import { openRung } from '@/lib/ladder-view';
import { Button } from './Button';
import { CardImage } from './CardImage';
import { Dialog } from './Dialog';
import { Gate } from './Gate';
import { Icon } from './Icon';
import { SpeedLimit, StopSign, TollGate, YieldSign } from './Signs';
import { useToast } from './Toast';
import { ConnectButton } from './ConnectButton';
import { Stepper } from './Stepper';

const RISK_KEY = 'gridlock.riskAck';
type Phase = 'idle' | 'checking' | 'signing' | 'waiting' | 'done';

export function MintView() {
  const chain = useChain();
  const wallet = useWallet();
  const toast = useToast();
  const params = useSearchParams();
  const [rank, setRank] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  const [minted, setMinted] = useState<number[]>(Array(15).fill(0));
  const [serial, setSerial] = useState<number | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [riskOpen, setRiskOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState<{ kind: 'bad' | 'warn'; text: string } | null>(null);
  const [result, setResult] = useState<{ hash: `0x${string}`; ids: number[] } | null>(null);

  const cars = chain.deployment?.cars;
  const openRungs = useMemo(() => chain.rungs.filter((r) => r.isOpen && r.sold < r.cap).sort((a, b) => b.rank - a.rank), [chain.rungs]);

  // Default rank: ?rank= if it is open, else the cheapest open rank.
  useEffect(() => {
    if (rank !== null && openRungs.some((r) => r.rank === rank)) return;
    const asked = Number(params.get('rank'));
    const pick = openRungs.find((r) => r.rank === asked) ?? openRung(chain.rungs);
    setRank(pick ? pick.rank : null);
  }, [openRungs, chain.rungs, params, rank]);

  const rung = chain.rungs.find((r) => r.rank === rank) ?? null;
  const account = wallet.account;

  useEffect(() => {
    if (!cars || !account) return;
    void readWalletMinted(cars, account).then(setMinted).catch(() => undefined);
  }, [cars, account, chain.totalMinted]);

  const left = rung ? rung.cap - rung.sold : 0;
  const walletLeft = rung ? Math.max(0, walletRankCap(rung.rank) - (account ? minted[rung.rank - 1] ?? 0 : 0)) : 0;
  const max = rung ? Math.max(0, Math.min(chain.constants?.txCap ?? 2, left, walletLeft)) : 0;
  const q = checkQuantity(qty, Math.max(1, max));
  const qtyOk = q.ok && max >= 1;

  useEffect(() => { if (max >= 1 && qty > max) setQty(max); }, [max, qty]);

  // Preview exactly the cars that will be minted: next serial, then serial + 1 for a second car.
  const sold = rung?.sold ?? 0;
  const renderer = chain.deployment?.renderer;
  useEffect(() => {
    if (!cars || !renderer || !rung || left < 1) { setSerial(null); setImages([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const p = await readPreview(cars, rung.rank);
        const imgs = [svgToDataUri(p.svg)];
        if (qty === 2 && left >= 2) imgs.push(svgToDataUri(await readSvg(renderer, rung.rank, p.serial + 1)));
        if (!cancelled) { setSerial(p.serial); setImages(imgs); }
      } catch { if (!cancelled) { setSerial(null); setImages([]); } }
    })();
    return () => { cancelled = true; };
  }, [cars, renderer, rung?.rank, sold, qty, left]); // eslint-disable-line react-hooks/exhaustive-deps

  const disabledReason = chain.viewOnly ? 'Minting is turned off in this interface for your region.'
    : chain.mismatches.length ? 'This deployment does not match the published parameters.'
    : wallet.wrongNetwork ? `Switch your wallet to ${CHAIN.name}.`
    : !rung ? 'No rank is open right now.'
    : left < 1 ? 'This rank is sold out.'
    : account && walletLeft < 1 ? 'This wallet is at its limit for this rank.'
    : null;

  const total = rung ? rung.priceWei * BigInt(qty) : 0n;

  const begin = () => {
    setMessage(null);
    let acked = false;
    try { acked = localStorage.getItem(RISK_KEY) === '1'; } catch { /* preference only */ }
    if (!acked) setRiskOpen(true); else setConfirmOpen(true);
  };

  const run = useCallback(async () => {
    if (!cars || !rung || !account || !wallet.walletClient || !wallet.walletPublic || serial === null) return;
    setConfirmOpen(false); setMessage(null); setPhase('checking');
    try {
      const fresh = await readPreview(cars, rung.rank);
      if (fresh.serial !== serial) {
        setSerial(fresh.serial); setImages([svgToDataUri(fresh.svg)]);
        setMessage({ kind: 'warn', text: `The next car changed to serial ${fresh.serial} while you were reviewing. Look at the new card, then confirm again. Nothing was sent.` });
        setPhase('idle'); return;
      }
      setPhase('signing');
      const r = await sendTx({ cars, functionName: 'mint', args: [BigInt(rung.rank), BigInt(qty), BigInt(serial)], value: total }, account, wallet.walletClient, wallet.walletPublic, () => setPhase('waiting'));
      await chain.refresh();
      const owned = await readOwned(cars, account, chain.totalMinted + qty + 50);
      setResult({ hash: r.hash, ids: owned.slice(-qty) });
      setPhase('done');
      toast.push({ kind: 'ok', title: 'Minted', text: `${qty} car${qty > 1 ? 's' : ''} minted.` });
    } catch (e) {
      const err = e instanceof TxError ? e : explainError(e);
      setPhase('idle');
      if (err.kind === 'serial') { await chain.refresh(); setMessage({ kind: 'warn', text: err.message }); }
      else setMessage({ kind: err.kind === 'rejected' ? 'warn' : 'bad', text: err.message });
    }
  }, [cars, rung, account, wallet.walletClient, wallet.walletPublic, serial, qty, total, chain, toast]);

  const busy = phase === 'checking' || phase === 'signing' || phase === 'waiting';
  const label = phase === 'checking' ? 'Checking the transaction' : phase === 'signing' ? 'Confirm in your wallet' : phase === 'waiting' ? 'Waiting for the network' : `Review ${qty} car${qty > 1 ? 's' : ''}`;

  return (
    <Gate>
      {chain.phase === 'ready' && openRungs.length === 0 && !result ? (
        <div className="empty"><Icon name="clock" /><div className="stack-tight"><h2>No rank is open</h2><p>Minting opens when the schedule says so. See which rank opens next and when.</p><Link className="btn btn--secondary" href="/ladder/">Open the Ladder</Link></div></div>
      ) : null}

      {result ? (
        <div className="stack">
          <div className="alert alert--ok" role="status"><Icon name="check" /><div><h2>Minted</h2><p>Your cars are minted. Check the receipt yourself.</p>
            <dl className="kv"><dt>Receipt</dt><dd>{explorerTx(result.hash) ? <a href={explorerTx(result.hash)} rel="noopener noreferrer">{shortAddress(result.hash)}</a> : <span className="num">{result.hash}</span>}</dd><dt>Car numbers</dt><dd className="num">{result.ids.join(', ')}</dd></dl></div></div>
          <div className="row"><Link className="btn btn--primary" href="/garage/">Open your Garage</Link><Button variant="secondary" onClick={() => { setResult(null); setPhase('idle'); }}>Mint another</Button></div>
        </div>
      ) : rung ? (
        <div className="split">
          <div className="stack">
            <fieldset className="stack-tight">
              <legend className="label">Open ranks</legend>
              {openRungs.map((r) => (
                <label key={r.rank} className="choice">
                  <input type="radio" name="rank" checked={rank === r.rank} onChange={() => { setRank(r.rank); setQty(1); setMessage(null); }} />
                  <span>Rank {r.rank}: <b>{formatEth(r.priceWei)}</b>, {r.cap - r.sold} of {r.cap} left</span>
                </label>
              ))}
            </fieldset>
            <div className="stack-tight">
              <span className="label" id="qty-label">Quantity</span>
              <Stepper value={qty} min={1} max={Math.max(1, max)} onChange={setQty} labelledBy="qty-label" disabled={max < 1} />
              <p className="help">{q.ok ? `Up to ${Math.max(1, max)} car${max > 1 ? 's' : ''} right now.` : q.error}</p>
              <SpeedLimit max={walletRankCap(rung.rank)} label={`Max per wallet, rank ${rung.rank}`} />
            </div>
            {message ? (message.kind === 'warn' ? <YieldSign title="Check this first"><p>{message.text}</p></YieldSign> : <div className="alert alert--bad" role="alert"><Icon name="alert" /><p>{message.text}</p></div>) : null}
          </div>
          <div className="stack">
            <div className="row" aria-live="polite">
              {images.map((src, i) => <CardImage key={`${rung.rank}-${(serial ?? 0) + i}`} src={src} size={images.length > 1 ? 200 : 260} alt={`Rank ${rung.rank} car, serial ${(serial ?? 0) + i}, as it will be minted`} />)}
              {images.length === 0 && left > 0 ? <CardImage src={null} alt="Loading card" size={260} /> : null}
            </div>
            <p className="dim">Serial {serial ?? '…'}{qty === 2 && serial ? ` and ${serial + 1}` : ''} of {rung.cap}. This is the exact card drawn by the contract.</p>
            <TollGate
              rows={[
                { label: 'Cars', value: `${qty} at rank ${rung.rank}` },
                { label: 'Price each', value: formatEth(rung.priceWei) },
                { label: 'Goes to', value: chain.constants ? shortAddress(chain.constants.treasury) : '' },
              ]}
              total={{ label: 'You pay, plus gas', value: formatEth(total) }}
              notes={[
                `100% of the price goes to the treasury address ${chain.constants?.treasury ?? ''}. There are no other recipients.`,
                'Secondary sales may pay a 5% royalty to the same treasury. That is a preference. Many marketplaces do not enforce it.',
                'Payment must be exact. The contract rejects any other amount, and there are no refunds.',
                'You see the car before you pay. Cards are set by rank and serial, not by chance.',
                'Heat is a picture of recent transfers. It changes no price, rule or right.',
                'Network gas is paid in ETH on top of the price.',
              ]}
            />
            {account ? (
              <Button variant="primary" size="lg" disabled={!qtyOk || disabledReason !== null || serial === null} loading={busy} onClick={begin}>{label}</Button>
            ) : (
              <div className="stack-tight"><p>Connect a wallet to continue.</p><ConnectButton /></div>
            )}
            {disabledReason && account ? <p className="help" role="status">{disabledReason}</p> : null}
            {chain.constants && explorerAddress(chain.constants.treasury) ? <p className="help">Treasury: <a href={explorerAddress(chain.constants.treasury)} rel="noopener noreferrer">view on the explorer</a></p> : null}
          </div>
        </div>
      ) : null}

      <Dialog open={riskOpen} onClose={() => setRiskOpen(false)} title="Read this once before your first mint" actions={<Button variant="primary" onClick={() => { try { localStorage.setItem(RISK_KEY, '1'); } catch { /* preference only */ } setRiskOpen(false); setConfirmOpen(true); }}>I understand, continue</Button>}>
        <ul className="stack-tight">
          <li>Minting is permanent. Cars cannot be returned and payments cannot be refunded.</li>
          <li>The contracts are immutable and have had no external audit yet. Bugs could cost you everything you pay.</li>
          <li>Gridlock Cars are digital collectibles. Nothing here promises value, income or a return.</li>
          <li>Anyone can see the next card, so bots can mint when it looks good.</li>
        </ul>
        <p><Link href="/risk/">Read the full risk notice</Link></p>
      </Dialog>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Mint is permanent" actions={<><Button variant="secondary" onClick={() => setConfirmOpen(false)}>Go back</Button><Button variant="primary" onClick={() => void run()}>{`Mint ${qty} car${qty > 1 ? 's' : ''} for ${formatEth(total)}`}</Button></>}>
        <StopSign title="Cannot be undone">
          <p>You are about to pay exactly {formatEth(total)} plus gas for {qty} rank {rung?.rank} car{qty > 1 ? 's' : ''} (serial {serial}{qty === 2 && serial ? ` and ${serial + 1}` : ''}). There are no refunds and no returns.</p>
        </StopSign>
      </Dialog>
    </Gate>
  );
}
