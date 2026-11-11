import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMaximumPrice, filterCards } from '../src/catalog.js';

const cards = Object.freeze([
  Object.freeze({ id: 'nicol', name: 'Nicol Bolas', collection: 'Lendas Épicas', number: '001', game: 'Magic', rarity: 'Épica', value: 3000, isOwner: true, isExample: true, createdAt: '2026-01-01' }),
  Object.freeze({ id: 'lymara', name: 'Lymara', collection: 'Magick IA', number: '002', game: 'Magick IA', rarity: 'Épica', value: 1500, isOwner: true, isExample: false, createdAt: '2026-11-10' }),
  Object.freeze({ id: 'arkanon', name: 'Arkanon', collection: 'Magick IA', number: '003', game: 'Magick IA', rarity: 'Épica', value: 1500.01, isOwner: true, isExample: false, createdAt: '2026-11-11' }),
  Object.freeze({ id: 'kaelthar', name: 'Kaelthar', collection: 'Magick IA', number: '004', game: 'Magick IA', rarity: 'Comum', value: 800, isOwner: false, isExample: false, createdAt: '2026-11-09' }),
  Object.freeze({ id: 'nyxsombra', name: 'Nyxsombra', collection: 'Magick IA', number: '005', game: 'Magick IA', rarity: 'Comum', value: 0, isOwner: false, isExample: true, createdAt: '2026-01-01' }),
  Object.freeze({ id: 'sem-valor', name: 'Carta sem valor informado', collection: 'Magick IA', number: '006', game: 'Magick IA', rarity: 'Rara', isOwner: true, isExample: false, createdAt: '2026-11-11' }),
  Object.freeze({ id: 'valor-nulo', name: 'Outra carta sem valor', collection: 'Magic', number: '007', game: 'Magic', rarity: 'Rara', value: null, isOwner: false, isExample: true, createdAt: '2026-01-01' }),
]);
const ids = result => result.map(card => card.id);

test('maximum price accepts Brazilian currency, decimal points, whole reais and an empty optional filter', () => {
  for (const [input, expected] of [
    ['1.500,00', 1500], ['R$ 100,50', 100.5], ['100.50', 100.5],
    ['1500', 1500], ['1.500', 1500], ['  100,5  ', 100.5],
    ['0', 0], ['0,00', 0], ['', null], ['   ', null], [null, null], [undefined, null],
  ]) assert.equal(parseMaximumPrice(input), expected, String(input));
});

test('maximum price rejects negatives, mixed or ambiguous formats and values beyond the supported limit', () => {
  for (const input of ['-1', '-0,01', '1,500', '1,500.00', '1.50,00', '100.0000', '1e3', 'Infinity', 'abc', '999.999.999,01']) {
    assert.throws(() => parseMaximumPrice(input), Error, input);
  }
  assert.equal(parseMaximumPrice('999.999.999,00'), 999999999);
});

test('combined category, game, ownership and maximum price include the exact price boundary', () => {
  assert.deepEqual(ids(filterCards(cards, {
    rarity: 'Épica', game: 'Magick IA', ownerOnly: true, maxPrice: 1500,
  })), ['lymara']);
  assert.deepEqual(ids(filterCards(cards, { rarity: 'epica', maxPrice: 3000, sort: 'high' })), ['nicol', 'arkanon', 'lymara']);
});

test('zero maximum price includes free cards and excludes missing values', () => {
  assert.deepEqual(ids(filterCards(cards, { maxPrice: 0 })), ['nyxsombra']);
  const limited = ids(filterCards(cards, { maxPrice: 999999999 }));
  assert.ok(!limited.includes('sem-valor'));
  assert.ok(!limited.includes('valor-nulo'));
  assert.ok(ids(filterCards(cards)).includes('sem-valor'), 'missing prices remain visible without a price limit');
});

test('search matches names, collections and numbers without depending on accents or case', () => {
  assert.deepEqual(ids(filterCards(cards, { query: '  ÉPICAS  ' })), ['nicol']);
  assert.deepEqual(ids(filterCards(cards, { query: 'LYMARA' })), ['lymara']);
  assert.deepEqual(ids(filterCards(cards, { query: '004' })), ['kaelthar']);
  assert.deepEqual(ids(filterCards(cards, { query: 'inexistente' })), []);
});

test('price ordering places missing prices last and supports alphabetical ordering', () => {
  assert.deepEqual(ids(filterCards(cards, { sort: 'high' })), ['nicol', 'arkanon', 'lymara', 'kaelthar', 'nyxsombra', 'sem-valor', 'valor-nulo']);
  assert.deepEqual(ids(filterCards(cards, { sort: 'low' })), ['nyxsombra', 'kaelthar', 'lymara', 'arkanon', 'nicol', 'sem-valor', 'valor-nulo']);
  assert.deepEqual(ids(filterCards(cards, { rarity: 'Épica', sort: 'name' })), ['arkanon', 'lymara', 'nicol']);
});

test('recent ordering prioritizes collector records before examples, then newest first', () => {
  assert.deepEqual(ids(filterCards(cards, { rarity: 'Épica', sort: 'recent' })), ['arkanon', 'lymara', 'nicol']);
});

test('filtering and sorting never mutate the original array or card records', () => {
  const before = JSON.stringify(cards);
  const result = filterCards(cards, { rarity: 'Épica', maxPrice: 3000, sort: 'name' });
  assert.notEqual(result, cards);
  assert.equal(JSON.stringify(cards), before);
  assert.deepEqual(ids(cards), ['nicol', 'lymara', 'arkanon', 'kaelthar', 'nyxsombra', 'sem-valor', 'valor-nulo']);
});
