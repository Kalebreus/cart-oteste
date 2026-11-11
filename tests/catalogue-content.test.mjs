import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { filterCards } from '../src/catalog.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assetsRoot = resolve(projectRoot, 'assets');
const cards = JSON.parse(readFileSync(resolve(assetsRoot, 'cards.json'), 'utf8'));

// These are the distinct cards in the supplied images. The logo and arrow
// are interface assets and must not become catalogue records.
const expectedGames = {
  'Magick IA': ['Arkanon', 'Drahven', 'Kaelthar', 'Lymara', 'Maldrik', 'Nyxsombra'],
  Magic: ['Sarabi, the Golden One', 'Stonecoil Serpent', 'Tibalt, Cosmic Impostor', 'Favored Hoplite', 'Nicol Bolas, Dragon-God', 'Sol Ring'],
  Pokémon: ['Lorena’s Gengar ex', 'Greninja ex', 'Umbreon ex', 'Charizard VSTAR'],
  'Yu-Gi-Oh!': ['Mago do Caos', 'Live☆Twin Lil-la Treat', 'Legendario Pescador Toon'],
};
const originalValues = {
  'Nicol Bolas, Dragon-God': { value: 3000, rarity: 'Épica' },
  'Umbreon ex': { value: 4000, rarity: 'Épica' },
  Kaelthar: { value: 800, rarity: 'Comum' },
  Maldrik: { value: 1500, rarity: 'Rara' },
  Drahven: { value: 600, rarity: 'Comum' },
  Nyxsombra: { value: 400, rarity: 'Comum' },
};
const purchaseUrlFromSuppliedHtml = 'https://wa.me/5511988185893?text=Olá,quero comprar a carta';

test('catalogue includes exactly the 19 supplied cards with unique identifiers and the correct games', () => {
  assert.equal(cards.length, 19);
  assert.equal(new Set(cards.map(card => card.id)).size, 19, 'card identifiers must be unique');
  assert.ok(cards.every(card => typeof card.id === 'string' && card.id.trim()), 'every record needs an identifier');
  assert.deepEqual(new Set(cards.map(card => card.name)), new Set(Object.values(expectedGames).flat()));
  assert.deepEqual(new Set(cards.map(card => card.game)), new Set(Object.keys(expectedGames)));
  for (const [game, names] of Object.entries(expectedGames)) {
    const actual = cards.filter(card => card.game === game);
    assert.equal(actual.length, names.length, `${game} count`);
    assert.deepEqual(new Set(actual.map(card => card.name)), new Set(names), `${game} card identities`);
  }
});

test('the six supplied prices and categories are preserved and all other prices remain explicitly unknown', () => {
  for (const [name, expected] of Object.entries(originalValues)) {
    const card = cards.find(card => card.name === name);
    assert.equal(card.value, expected.value, `${name} supplied price`);
    assert.equal(card.rarity, expected.rarity, `${name} supplied category`);
    assert.equal(card.currency, 'BRL');
  }
  const withoutSuppliedPrice = cards.filter(card => !Object.hasOwn(originalValues, card.name));
  assert.equal(withoutSuppliedPrice.length, 13);
  for (const card of withoutSuppliedPrice) {
    assert.equal(card.value, null, `${card.name} must not acquire an invented or zero price`);
  }
  assert.equal(cards.filter(card => card.value === 0).length, 0);
});

test('each game filter exposes the complete set of supplied cards for that game', () => {
  for (const [game, names] of Object.entries(expectedGames)) {
    const filtered = filterCards(cards, { game });
    assert.equal(filtered.length, names.length, `${game} filter count`);
    assert.deepEqual(new Set(filtered.map(card => card.name)), new Set(names));
    assert.ok(filtered.every(card => card.game === game));
  }
  assert.equal(filterCards(cards, { game: 'Todos' }).length, 19);
});

test('every available card image is a local, readable PNG or JPEG with a matching file signature', () => {
  const available = cards.filter(card => card.image);
  assert.ok(available.length >= 12, 'the twelve recovered original artworks must remain available');
  const signatures = {
    '.png': { mime: 'image/png', bytes: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) },
    '.jpg': { mime: 'image/jpeg', bytes: Buffer.from([255, 216, 255]) },
    '.jpeg': { mime: 'image/jpeg', bytes: Buffer.from([255, 216, 255]) },
  };
  for (const card of available) {
    assert.ok(card.image.startsWith('/assets/'), `${card.name} must use a local asset`);
    const imagePath = resolve(projectRoot, card.image.slice(1));
    assert.ok(imagePath.startsWith(assetsRoot + sep), `${card.name} asset path must stay inside assets`);
    const format = signatures[extname(imagePath).toLowerCase()];
    assert.ok(format, `${card.name} must have a supported PNG/JPEG MIME type`);
    const content = readFileSync(imagePath);
    assert.ok(content.length > format.bytes.length, `${card.name} image must not be empty`);
    assert.deepEqual(content.subarray(0, format.bytes.length), format.bytes, `${card.name} ${format.mime} signature`);
  }
});

test('unavailable artwork has an explicit pending status and an empty image URL', () => {
  for (const card of cards) {
    if (card.image === '') {
      assert.equal(card.imageStatus, 'pending', `${card.name} missing artwork must be marked pending`);
    } else {
      assert.equal(typeof card.image, 'string');
      assert.equal(card.imageStatus, 'available', `${card.name} recovered artwork must be marked available`);
    }
    if (card.imageStatus === 'pending') assert.equal(card.image, '', `${card.name} pending artwork must have no image URL`);
  }
});

test('purchase links exist only on the six original HTML entries and keep their supplied destination', () => {
  const originalIds = new Set(['reference-1', 'reference-2', 'reference-3', 'reference-4', 'reference-5', 'reference-6']);
  for (const card of cards) {
    if (originalIds.has(card.id)) {
      assert.equal(card.purchaseUrl, purchaseUrlFromSuppliedHtml, `${card.name} original purchase destination`);
    } else {
      assert.ok(!card.purchaseUrl, `${card.name} must not receive an invented purchase link`);
    }
  }
  assert.equal(cards.filter(card => card.purchaseUrl).length, 6);
});
