import { BaseError, type Address, type Hash } from 'viem';
import { carsAbi } from './gridlock-abi';
import { publicClient } from './chain';
import type { WalletClient, PublicClient } from 'viem';
import { viemChain } from './config';

/** Plain-language messages. Each says whether money or the car moved. */
const ERRORS: Record<string, string> = {
  BadRank: 'That rank does not exist. Nothing was sent.',
  BadQuantity: 'Quantity must be 1 or 2 cars. Nothing was sent.',
  NotOpen: 'This rank is not open yet. Nothing was sent.',
  WrongPayment: 'The payment did not match the price. Nothing was sent.',
  SoldOut: 'This rank just sold out. Nothing was sent.',
  NotEnoughLeft: 'Not enough cars are left in this rank for that quantity. Nothing was sent.',
  WalletCapReached: 'This wallet is at its limit for this rank. Nothing was sent.',
  NoCommit: 'There is no saved commit for this wallet. Do step 1 first. Nothing was sent.',
  CommitMismatch: 'This code, car or wallet does not match your commit. Nothing was sent.',
  RevealTooEarly: 'The wait after your commit is not over. Nothing was sent.',
  BadSecret: 'That code does not open this car. Nothing was sent.',
  AlreadyClaimed: 'Someone already claimed this car. Nothing was sent.',
  EmptyCommitment: 'The commit was empty. Nothing was sent.',
  BadIndex: 'Pick a car from the list. Nothing was sent.',
  NotOwnerNorApproved: 'This wallet does not own that car. Nothing was sent.',
  TransferToZeroAddress: 'The zero address cannot receive a car. Nothing was sent.',
};

export class TxError extends Error {
  constructor(message: string, readonly kind: 'rejected' | 'contract' | 'serial' | 'other', readonly nextSerial?: number) { super(message); }
}

export function explainError(e: unknown): TxError {
  if (e instanceof TxError) return e;
  const code = (e as { code?: number; cause?: { code?: number } })?.code ?? (e as { cause?: { code?: number } })?.cause?.code;
  if (code === 4001) return new TxError('You cancelled in your wallet. Nothing was sent.', 'rejected');
  if (e instanceof BaseError) {
    const walked = e.walk((x) => typeof (x as { data?: { errorName?: string } }).data?.errorName === 'string') as { data?: { errorName: string; args?: readonly unknown[] } } | null;
    const name = walked?.data?.errorName;
    if (name === 'SerialMismatch') {
      const n = Number(walked?.data?.args?.[0] ?? 0);
      return new TxError(`The next car changed. It is now serial ${n}. Review the new card and try again. Nothing was sent.`, 'serial', n);
    }
    if (name && ERRORS[name]) return new TxError(ERRORS[name], 'contract');
    if (/insufficient funds/i.test(e.message)) return new TxError('Not enough ETH for the price plus gas. Nothing was sent.', 'other');
    if (/busy|rate limit|429/i.test(e.message)) return new TxError('The network connection is busy. Nothing was sent. Try again in a moment.', 'other');
  }
  return new TxError('The transaction could not be checked, so it was not sent. Your ETH and cars are unchanged.', 'other');
}

export interface TxCall { cars: Address; functionName: 'mint' | 'commitClaim' | 'revealClaim' | 'safeTransferFrom' | 'withdraw'; args: readonly unknown[]; value?: bigint }

/** Simulates first (nothing is signed if this fails), then asks the wallet to sign, then waits for the receipt. */
export async function sendTx(c: TxCall, account: Address, wallet: WalletClient, walletPublic: PublicClient, onSent?: (h: Hash) => void): Promise<{ hash: Hash; blockNumber: bigint }> {
  try {
    const sim = await publicClient.simulateContract({ address: c.cars, abi: carsAbi, functionName: c.functionName, args: c.args, account, ...(c.value !== undefined ? { value: c.value } : {}) } as never);
    const hash = await wallet.writeContract({ ...(sim as { request: object }).request, chain: viemChain, account } as never);
    onSent?.(hash);
    const receipt = await walletPublic.waitForTransactionReceipt({ hash, timeout: 120_000 });
    if (receipt.status !== 'success') throw new TxError('The transaction was included but failed. Check the explorer. Your car and ETH may be unchanged.', 'other');
    return { hash, blockNumber: receipt.blockNumber };
  } catch (e) {
    throw explainError(e);
  }
}
