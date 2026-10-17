import test from 'node:test';
import assert from 'node:assert/strict';
import {estateWorkspace} from '../estate-workspace.js';

test('estate summary retains a projected loss with the existing unsigned money formatter', () => {
  const html = estateWorkspace({
    p: {empire: {venues: {}, week: 1, year: 1}}, balance: 5000,
    snapshot: {weekly: {net: -2500}, gross: 0}, claimable: 0, stars: 0,
    view: 'overview', content: '', money: value => '$' + Math.max(0, value).toLocaleString('en-US')
  });
  assert.match(html, /−\$2,500 projected net/);
  assert.match(html, /class="negative">−\$2,500/);
  assert.doesNotMatch(html, /\$0 projected net/);
});
