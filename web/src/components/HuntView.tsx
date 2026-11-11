'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { readCommit, readHunt, readHuntHash } from '@/lib/chain';
import { useChain } from '@/lib/chain-context';
import { useWallet } from '@/lib/wallet';
import { sendTx, TxError, explainError } from '@/lib/tx';
import { checkHuntIndex, checkSecret } from '@/lib/validation';
import { huntCommitment, huntHash, huntSalt } from '@/lib/hunt';
import { explorerTx } from '@/lib/config';
import { formatUtc, shortAddress } from '@/lib/format';
import { Button } from './Button';
import { ConnectButton } from './ConnectButton';
import { Countdown } from './Countdown';
import { Field } from './Field';
import { Gate } from './Gate';
import { Icon } from './Icon';
import { StopSign, YieldSign } from './Signs';

type Commit = { commitment: `0x${string}`; committedAt: number; revealableAt: number };
const ZERO = `0x${'0'.repeat(64)}`;

export function HuntView() {
  const c = useChain();
  const w = useWallet();
  const [claimers, setClaimers] = useState<string[]>([]);
  const [ids, setIds] = useState<number[]>([]);
  const [commit, setCommit] = useState<Commit | null>(null);
  const [index, setIndex] = useState('0');
  const [secret, setSecret] = useState('');
  const [errs, setErrs] = useState<{ index?: string; secret?: string }>({});
  const [busy, setBusy] = useState<'commit' | 'reveal' | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);
  const cars = c.deployment?.cars;
  const account = w.account;
  const hasCommit = commit !== null && commit.commitment !== ZERO;

  const load = useCallback(async () => {
    if (!cars) return;
    try {
      const h = await readHunt(cars);
      setClaimers(h.claimers); setIds(h.tokenIds);
      if (account) setCommit(await readCommit(cars, account));
    } catch { /* the page keeps its last data; Gate handles a dead network */ }
  }, [cars, account]);
  useEffect(() => { void load(); }, [load, c.totalMinted]);

  const validate = async (): Promise<{ i: number; s: `0x${string}` } | null> => {
    const i = checkHuntIndex(index); const s = checkSecret(secret);
    const e: { index?: string; secret?: string } = {};
    if (!i.ok) e.index = i.error;
    if (!s.ok) e.secret = s.error;
    if (i.ok && s.ok && cars) {
      const onChain = await readHuntHash(cars, i.value).catch(() => null);
      if (onChain && onChain.toLowerCase() !== huntHash(s.value).toLowerCase()) e.secret = 'This code does not open that car. Check the code and the car number.';
    }
    setErrs(e);
    return i.ok && s.ok && !e.secret && !e.index ? { i: i.value, s: s.value } : null;
  };

  const doCommit = async () => {
    setMsg(null);
    if (!cars || !account || !w.walletClient || !w.walletPublic) return;
    const v = await validate();
    if (!v) return;
    if (claimers[v.i] && !/^0x0+$/.test(claimers[v.i]!)) { setErrs({ index: 'That car is already claimed.' }); return; }
    setBusy('commit');
    try {
      const t = await sendTx({ cars, functionName: 'commitClaim', args: [huntCommitment(v.s, account, v.i)] }, account, w.walletClient, w.walletPublic);
      setReceipt(t.hash); setMsg({ ok: true, text: 'Step 1 is saved. Wait for the timer, then do step 2 with the same code and car number.' });
      await load();
    } catch (e) { setMsg({ ok: false, text: (e instanceof TxError ? e : explainError(e)).message }); } finally { setBusy(null); }
  };

  const doReveal = async () => {
    setMsg(null); setConfirm(false);
    if (!cars || !account || !w.walletClient || !w.walletPublic || !commit) return;
    const v = await validate();
    if (!v) return;
    if (huntCommitment(v.s, account, v.i).toLowerCase() !== commit.commitment.toLowerCase()) { setErrs({ secret: 'This code and car number do not match your step 1. Use the same ones.' }); return; }
    setBusy('reveal');
    try {
      const t = await sendTx({ cars, functionName: 'revealClaim', args: [BigInt(v.i), v.s, huntSalt(account, v.i)] }, account, w.walletClient, w.walletPublic);
      setReceipt(t.hash); setMsg({ ok: true, text: 'Claimed. The hidden car is in your Garage.' }); setSecret('');
      await c.refresh(); await load();
    } catch (e) { setMsg({ ok: false, text: (e instanceof TxError ? e : explainError(e)).message }); } finally { setBusy(null); }
  };

  const [, setTick] = useState(0);
  const now = c.now();
  const waiting = hasCommit && commit !== null && now < commit.revealableAt;
  const disabled = c.viewOnly || c.mismatches.length > 0 || w.wrongNetwork;
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [waiting]);
  const claimedCount = claimers.filter((a) => a && !/^0x0+$/.test(a)).length;

  return (
    <div className="stack">
      <Gate>
        <section className="stack-tight" aria-labelledby="hunt-status">
          <h2 id="hunt-status">The 12 hidden cars</h2>
          <p className="dim" role="status">{claimedCount} of 12 claimed.</p>
          <ul className="card-grid">
            {Array.from({ length: 12 }, (_, i) => {
              const a = claimers[i]; const done = !!a && !/^0x0+$/.test(a);
              return (
                <li key={i} className="panel stack-tight">
                  <span className="label">Hidden car {i}</span>
                  <span className="row"><Icon name={done ? 'check' : 'lock'} />{done ? `Claimed by ${shortAddress(a!)}` : 'Not claimed'}</span>
                  {done && ids[i] ? <Link href={`/gallery/?id=${ids[i]}`}>See car #{ids[i]}</Link> : null}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="stack" aria-labelledby="hunt-claim">
          <h2 id="hunt-claim">Claim a hidden car</h2>
          {!account ? <div className="stack-tight"><p>Connect a wallet to claim.</p><ConnectButton /></div> : (
            <>
              {hasCommit && waiting && commit ? (
                <div className="panel stack-tight"><p>Step 1 is saved. You can do step 2 in:</p><Countdown target={commit.revealableAt} nowFn={c.now} label="Time until you can claim" /><p className="dim">Earliest {formatUtc(commit.revealableAt)}.</p></div>
              ) : hasCommit ? <div className="alert alert--ok" role="status"><Icon name="check" /><p>Step 1 is saved and the wait is over. Do step 2 now.</p></div> : null}
              <Field id="hunt-index" label="Hidden car number (0 to 11)" inputMode="numeric" value={index} onChange={(e) => { setIndex(e.target.value); setErrs((p) => ({ ...p, index: undefined })); }} error={errs.index} autoComplete="off" />
              <Field id="hunt-secret" label="Your hunt code" type="password" value={secret} onChange={(e) => { setSecret(e.target.value); setErrs((p) => ({ ...p, secret: undefined })); }} error={errs.secret} help="0x followed by 64 characters. This site never stores it and it never leaves your device until step 2 is sent." autoComplete="off" spellCheck={false} />
              <div className="row">
                <Button variant="secondary" loading={busy === 'commit'} disabled={disabled || busy !== null} onClick={() => void doCommit()}>Step 1: save my claim</Button>
                <Button variant="primary" loading={busy === 'reveal'} disabled={disabled || busy !== null || !hasCommit || waiting} onClick={() => void (async () => { if (await validate()) setConfirm(true); })()}>Step 2: claim the car</Button>
              </div>
              {hasCommit ? <YieldSign title="A new step 1 replaces the old one"><p>Saving a claim again overwrites your earlier saved claim. Only do it if you are starting over.</p></YieldSign> : null}
              {confirm ? <StopSign title="Claim is permanent"><p>This sends your code to the network, where anyone can see it. Claim now?</p><div className="row"><Button variant="secondary" onClick={() => setConfirm(false)}>Go back</Button><Button variant="primary" onClick={() => void doReveal()}>Claim car {index}</Button></div></StopSign> : null}
              {msg ? <div className={`alert ${msg.ok ? 'alert--ok' : 'alert--bad'}`} role={msg.ok ? 'status' : 'alert'}><p>{msg.text} {receipt && msg.ok && explorerTx(receipt) ? <a href={explorerTx(receipt)} rel="noopener noreferrer">View the receipt</a> : null}</p></div> : null}
            </>
          )}
        </section>
      </Gate>

      <section className="stack-tight" aria-labelledby="hunt-rules">
        <h2 id="hunt-rules">How the Hunt works</h2>
        <p>Twelve hidden cars are not for sale. Each is opened by a secret code. The contract stores only a public fingerprint of each code, so nobody can read the codes from the chain or from this site. This site gives no hints.</p>
        <p>Claiming takes two steps so nobody can copy your code from the network and claim first. Step 1 saves a sealed claim. After a wait, step 2 shows the code and mints the car. Each hidden car can be claimed once. There is no reward and no prize beyond the car itself.</p>
      </section>
    </div>
  );
}
