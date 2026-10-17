import test from 'node:test';
import assert from 'node:assert/strict';
import {matchingHomeGames} from '../home-workspace.js';

const games = [{id:'blackjack',name:'Blackjack',level:1},{id:'roulette',name:'European Roulette',level:1},{id:'slots',name:'House Slots',level:2},{id:'holdem',name:"Texas Hold'em",level:4}];
test('home search respects the selected floor and supports discovery across all levels', () => {
  assert.deepEqual(matchingHomeGames(games).map(game => game.id), ['blackjack','roulette']);
  assert.deepEqual(matchingHomeGames(games,{floor:'all',query:'  HOUSE '}).map(game => game.id), ['slots']);
  assert.deepEqual(matchingHomeGames(games,{floor:'1',query:'Slots'}), []);
  assert.deepEqual(matchingHomeGames(games,{floor:'4'}).map(game => game.id), ['holdem']);
  assert.deepEqual(matchingHomeGames(games,{floor:'all',query:'does not exist'}), []);
});
