import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BLUEPRINT_ID_PATTERN,
  clampArray,
  clampString,
  nonNegativeNumber,
  removeUndefined,
  sanitizeId,
} from './validation';

test('sanitizeId strips unsafe characters, enforces 128-char cap, and matches blueprint pattern', () => {
  const dirty = 'ord/../999 with spaces & symbols!!';
  const clean = sanitizeId(dirty, 'ord');
  assert.match(clean, BLUEPRINT_ID_PATTERN);
  assert.ok(!clean.includes('/'));
  assert.ok(!clean.includes(' '));

  const oversized = 'a'.repeat(500);
  const capped = sanitizeId(oversized, 'ord');
  assert.equal(capped.length, 128);
  assert.match(capped, BLUEPRINT_ID_PATTERN);

  const empty = sanitizeId('   ', 'ord');
  assert.ok(empty.startsWith('ord-'));
  assert.match(empty, BLUEPRINT_ID_PATTERN);
});

test('clampString trims, enforces max length, and respects fallback on empty values', () => {
  assert.equal(clampString('  K Town Burger  ', 100), 'K Town Burger');
  assert.equal(clampString('x'.repeat(10000), 120).length, 120);
  assert.equal(clampString('   ', 50, 'Guest'), 'Guest');
  assert.equal(clampString(null, 50, 'Fallback'), 'Fallback');
});

test('clampArray and nonNegativeNumber enforce resource and numeric bounds', () => {
  assert.deepEqual(clampArray([1, 2, 3, 4], 2), [1, 2]);
  assert.deepEqual(clampArray(undefined, 5), []);

  assert.equal(nonNegativeNumber(-50, 0), 0);
  assert.equal(nonNegativeNumber(Number.NaN, 5000), 5000);
  assert.equal(nonNegativeNumber('24000', 0), 24000);
});

test('removeUndefined strips undefined keys while preserving falsy booleans and zeros', () => {
  const cleaned = removeUndefined({
    id: 'm-1',
    price: 0,
    available: false,
    comboUpgradePrice: undefined,
    sizes: [],
  });
  assert.equal('comboUpgradePrice' in cleaned, false);
  assert.equal(cleaned.price, 0);
  assert.equal(cleaned.available, false);
  assert.deepEqual(cleaned.sizes, []);
});
