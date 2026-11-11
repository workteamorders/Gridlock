import { encodeAbiParameters, keccak256, parseAbiParameters, toBytes, type Address, type Hex } from 'viem';

/** Salt is derived, not stored, so the site keeps nothing about a claim. Only the secret itself is typed again at step 2. */
export function huntSalt(account: Address, index: number): Hex {
  return keccak256(toBytes(`gridlock-hunt-salt:${account.toLowerCase()}:${index}`));
}

/** c = keccak256(abi.encode(secret, claimer, salt)). Must match GridlockCars.revealClaim. */
export function huntCommitment(secret: Hex, account: Address, index: number): Hex {
  return keccak256(encodeAbiParameters(parseAbiParameters('bytes32, address, bytes32'), [secret, account, huntSalt(account, index)]));
}

/** Hash the contract stores for each hidden car: keccak256(abi.encodePacked(secret)). For bytes32 that is keccak256 of the 32 raw bytes. */
export function huntHash(secret: Hex): Hex {
  return keccak256(secret);
}
