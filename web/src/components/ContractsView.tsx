'use client';

import { useChain } from '@/lib/chain-context';
import { CHAIN, CHAIN_ID, AUDIT_REPORT_URL, explorerAddress } from '@/lib/config';
import { formatDuration, formatEth, formatUtc } from '@/lib/format';
import { Gate } from './Gate';
import { Icon } from './Icon';

function Addr({ label, a }: { label: string; a: string }) {
  const href = explorerAddress(a);
  return <><dt>{label}</dt><dd className="num">{a}{href ? <> <a href={href} rel="noopener noreferrer">Explorer</a></> : null}</dd></>;
}

export function ContractsView() {
  const c = useChain();
  return (
    <Gate>
      {c.constants && c.deployment ? (
        <div className="stack">
          {c.mismatches.length ? (
            <div className="alert alert--bad" role="alert"><Icon name="alert" /><div><h2>This deployment does not match the published parameters</h2><ul>{c.mismatches.map((m) => <li key={m}>{m}</li>)}</ul></div></div>
          ) : c.deployment.expected ? (
            <div className="alert alert--ok" role="status"><Icon name="check" /><p>The values below match the published parameters. This compares numbers. It is not an audit, and it does not prove the contract code is safe.</p></div>
          ) : (
            <div className="alert alert--warn" role="status"><Icon name="alert" /><p>No published parameters were found to compare with, so the values below are shown but not checked.</p></div>
          )}
          <dl className="kv">
            <dt>Network</dt><dd>{CHAIN.name} ({CHAIN_ID})</dd>
            <Addr label="Cars contract" a={c.deployment.cars} />
            <Addr label="Renderer contract" a={c.constants.renderer} />
            <Addr label="Treasury" a={c.constants.treasury} />
            <dt>Start time</dt><dd>{formatUtc(c.constants.startTime)}</dd>
            <dt>Rank open timeout</dt><dd>{formatDuration(c.constants.openTimeout)}</dd>
            <dt>Heat falls by 1 every</dt><dd>{formatDuration(c.constants.heatDecaySeconds)}</dd>
            <dt>Hunt wait between steps</dt><dd>{formatDuration(c.constants.revealMinDelay)}</dd>
            <dt>Royalty</dt><dd>{c.constants.royaltyBps / 100}% (a preference marketplaces may ignore)</dd>
            <dt>Cars per transaction</dt><dd>{c.constants.txCap}</dd>
          </dl>
          <div className="table-wrap">
            <table className="table">
              <caption>Caps and prices read from the contract</caption>
              <thead><tr><th scope="col">Rank</th><th scope="col">Cap</th><th scope="col">Price</th></tr></thead>
              <tbody>{[...c.rungs].sort((a, b) => b.rank - a.rank).map((r) => <tr key={r.rank}><th scope="row" className="num">{r.rank}</th><td data-label="Cap" className="num">{r.cap}</td><td data-label="Price" className="num">{formatEth(r.priceWei)}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      ) : null}
      <div className="stack-tight">
        <h2>Audit status</h2>
        {AUDIT_REPORT_URL ? <p>External audit report: <a href={AUDIT_REPORT_URL} rel="noopener noreferrer">read it</a>.</p> : <p><strong>No external audit yet.</strong> The contracts are immutable. Treat anything you pay as at risk.</p>}
        <p>Source code, tests and the audit packet are in the project repository. Compare the code at the addresses above with that source before you rely on it.</p>
      </div>
    </Gate>
  );
}
