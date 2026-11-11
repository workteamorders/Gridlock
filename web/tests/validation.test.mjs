import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkQuantity, checkCarId, checkAddress, checkSecret, checkHuntIndex } from '../src/lib/validation.ts';
import { huntCommitment, huntHash, huntSalt } from '../src/lib/hunt.ts';
import { keccak256, toHex } from 'viem';

test('quantity', () => {
  assert.equal(checkQuantity(1, 2).ok, true);
  assert.equal(checkQuantity(2, 2).ok, true);
  for (const bad of [0, 3, -1, 1.5, NaN, '', 'a']) assert.equal(checkQuantity(bad, 2).ok, false, String(bad));
  assert.equal(checkQuantity(2, 1).ok, false);
});
test('car id', () => {
  assert.equal(checkCarId('12', 50).ok, true);
  for (const bad of [null, '', '0', '51', '-1', '1.5', '1e3', '0x1', '1234567', ' 1']) assert.equal(checkCarId(bad, 50).ok, false, String(bad));
});
test('address', () => {
  assert.equal(checkAddress('0x' + 'a'.repeat(40)).ok, true);
  for (const bad of ['', '0x', '0x' + 'g'.repeat(40), '0x' + 'a'.repeat(39), '0x' + '0'.repeat(40)]) assert.equal(checkAddress(bad).ok, false, bad);
});
test('secret and hunt index', () => {
  assert.equal(checkSecret('0x' + 'ab'.repeat(32)).ok, true);
  assert.equal(checkSecret('0x' + 'ab'.repeat(31)).ok, false);
  assert.equal(checkHuntIndex('0').ok, true); assert.equal(checkHuntIndex('11').ok, true);
  for (const bad of ['', '12', '-1', 'a', '1.0']) assert.equal(checkHuntIndex(bad).ok, false, bad);
});
test('hunt hash matches the contract definition keccak256(abi.encodePacked(bytes32))', () => {
  const s = keccak256(toHex('GRIDLOCK-TEST-ONLY-SECRET-0'));
  assert.equal(huntHash(s), keccak256(s));
});
test('hunt salt is stable and depends on account and index', () => {
  const a = '0x' + '11'.repeat(20), b = '0x' + '22'.repeat(20);
  assert.equal(huntSalt(a, 1), huntSalt(a, 1));
  assert.notEqual(huntSalt(a, 1), huntSalt(a, 2));
  assert.notEqual(huntSalt(a, 1), huntSalt(b, 1));
  const s = keccak256(toHex('x'));
  assert.notEqual(huntCommitment(s, a, 0), huntCommitment(s, a, 1));
});
