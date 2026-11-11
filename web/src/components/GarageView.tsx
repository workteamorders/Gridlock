'use client';

import { StatusArt } from '@/components/fx/StatusArt';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { readCar, readOwned, type CarInfo } from '@/lib/chain';
import { useChain } from '@/lib/chain-context';
import { useWallet } from '@/lib/wallet';
import { sendTx, TxError, explainError } from '@/lib/tx';
import { checkAddress } from '@/lib/validation';
import { explorerTx } from '@/lib/config';
import { formatUtc, shortAddress } from '@/lib/format';
import type { Stars } from '@/lib/heat';
import { Button } from './Button';
import { CarTile } from './CarTile';
import { ConnectButton } from './ConnectButton';
import { Dialog } from './Dialog';
import { Field } from './Field';
import { Gate } from './Gate';
import { HeatStars } from './HeatStars';
import { StopSign, YieldSign } from './Signs';
import { useToast } from './Toast';

export function GarageView() {
  const c = useChain();
  const w = useWallet();
  const toast = useToast();
  const [cars, setCars] = useState<CarInfo[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [sending, setSending] = useState<CarInfo | null>(null);
  const [to, setTo] = useState('');
  const [toErr, setToErr] = useState<string | undefined>();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const cars0 = c.deployment?.cars;
  const account = w.account;

  const load = useCallback(async () => {
    if (!cars0 || !account) return;
    setFailed(false);
    try {
      const ids = await readOwned(cars0, account, c.totalMinted);
      setCars(await Promise.all(ids.map((id) => readCar(cars0, id))));
    } catch { setFailed(true); }
  }, [cars0, account, c.totalMinted]);
  useEffect(() => { setCars(null); void load(); }, [load]);

  const open = (car: CarInfo) => { setSending(car); setTo(''); setToErr(undefined); setMsg(null); setConfirm(false); setReceipt(null); };
  const review = () => {
    const r = checkAddress(to);
    if (!r.ok) { setToErr(r.error); return; }
    if (account && r.value.toLowerCase() === account.toLowerCase()) { setToErr('That is your own address. Nothing would change.'); return; }
    setToErr(undefined); setConfirm(true);
  };
  const send = async () => {
    const r = checkAddress(to);
    if (!r.ok || !cars0 || !account || !sending || !w.walletClient || !w.walletPublic) return;
    setBusy(true); setMsg(null);
    try {
      const t = await sendTx({ cars: cars0, functionName: 'safeTransferFrom', args: [account, r.value, BigInt(sending.id)] }, account, w.walletClient, w.walletPublic);
      const sent = sending.id;
      setReceipt(t.hash); setConfirm(false); setSending(null);
      const tile = document.getElementById(`garage-car-${sent}`);
      if (tile && document.documentElement.dataset.motion === 'full') {
        tile.dataset.departing = 'true';
        await new Promise<void>((resolve) => window.setTimeout(resolve, 240));
      }
      setCars((current) => current?.filter((car) => car.id !== sent) ?? null);
      toast.push({ kind: 'ok', title: 'Car sent', text: `Car #${sending.id} was sent.` });
      await c.refresh(); await load();
    } catch (e) { setMsg((e instanceof TxError ? e : explainError(e)).message); setConfirm(false); } finally { setBusy(false); }
  };

  return (
    <Gate>
      {receipt ? <div className="alert alert--ok" role="status"><p>Sent. {explorerTx(receipt) ? <a href={explorerTx(receipt)} rel="noopener noreferrer">View the receipt</a> : null}</p></div> : null}
      {!account ? (
        <div className="empty"><div className="stack-tight"><h2>Connect to see your cars</h2><p>Your Garage lists the cars your wallet owns. Connecting only reads your address. It never moves anything.</p><ConnectButton /></div></div>
      ) : w.wrongNetwork ? (
        <YieldSign title="Wrong network"><p>Switch your wallet to the right network to see your cars.</p><Button variant="secondary" onClick={() => void w.switchNetwork()}>Switch network</Button></YieldSign>
      ) : failed ? (
        <div className="alert alert--bad" role="alert"><p>Your cars could not be loaded. Nothing changed.</p><Button variant="secondary" onClick={() => void load()}>Try again</Button></div>
      ) : cars === null ? (
        <div className="skeleton gate-sk" role="status" aria-busy="true" aria-label="Loading your cars" />
      ) : cars.length === 0 ? (
        <div className="empty"><StatusArt kind="empty" /><div className="stack-tight"><h2>Your Garage is empty</h2><p>No cars in {shortAddress(account)} yet.</p><Link className="btn btn--primary" href="/mint/">Go to Mint</Link></div></div>
      ) : (
        <div className="stack">
          <p className="dim">{cars.length} car{cars.length > 1 ? 's' : ''} in {shortAddress(account)}.</p>

          {msg ? <div className="alert alert--bad" role="alert"><p>{msg}</p></div> : null}
          <ul className="card-grid">
            {cars.map((car) => (
              <li key={car.id} className="stack-tight" id={`garage-car-${car.id}`}>
                <CarTile car={car} />
                {car.heat > 0 && car.heatZeroAt ? <p className="dim">Heat 0 at {formatUtc(car.heatZeroAt)} if not moved.</p> : null}
                <Button variant="secondary" size="sm" onClick={() => open(car)} disabled={c.viewOnly}>Send car #{car.id}</Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog
        open={sending !== null}
        onClose={() => { setSending(null); setConfirm(false); }}
        title={confirm ? 'Send is permanent' : `Send car #${sending?.id ?? ''}`}
        actions={confirm ? (
          <><Button variant="secondary" onClick={() => setConfirm(false)}>Go back</Button><Button variant="primary" loading={busy} onClick={() => void send()}>{`Send car #${sending?.id ?? ''}`}</Button></>
        ) : (
          <><Button variant="secondary" onClick={() => setSending(null)}>Cancel</Button><Button variant="primary" onClick={review}>Review</Button></>
        )}
      >
        {confirm ? (
          <StopSign title="Cannot be undone"><p>Car #{sending?.id} goes to <span className="num">{to.trim()}</span>. If the address is wrong, the car is lost. Nobody can return it.</p></StopSign>
        ) : (
          <div className="stack">
            <YieldSign title="Sending adds heat"><p>Every transfer adds {c.constants?.heatPerTransfer ?? 20} heat to the car. Heat is only a picture of recent moves. It changes no price, rule or right.</p></YieldSign>
            <Field id="send-to" label="Send to this address" value={to} onChange={(e) => { setTo(e.target.value); setToErr(undefined); }} error={toErr} help="0x followed by 40 characters. Check every character: sends cannot be undone." autoComplete="off" spellCheck={false} />
            {sending ? <p className="row"><HeatStars stars={sending.stars as Stars} /></p> : null}
          </div>
        )}
      </Dialog>
    </Gate>
  );
}
