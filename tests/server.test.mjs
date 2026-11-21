import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createHandler } from '../src/server.js';

const ORIGIN = 'https://gold-packs.test';
const USERS = {
  ana: { id: 'user-ana', name: 'Ana Colecionadora' },
  bruno: { id: 'user-bruno', name: 'Bruno' },
};
const CARD = {
  name: 'Pikachu VMAX', game: 'Pokémon', collection: 'Vivid Voltage',
  number: '188/185', rarity: 'Secreta', value: 249.95,
  condition: 'Excelente', image: '', notes: 'Carta da coleção pessoal.',
};
const VIDEO = {
  title: 'Abrindo meu primeiro pack', game: 'Pokémon', description: 'Uma abertura completa.',
  sourceType: 'youtube', source: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
};

// A narrow D1 adapter: application SQL runs against the actual SQLite schema.
function createD1() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  sqlite.exec(readFileSync(new URL('../drizzle/0000_gold_packs.sql', import.meta.url), 'utf8'));
  class Statement {
    constructor(sql, values = []) { this.sql = sql; this.values = values; }
    bind(...values) { return new Statement(this.sql, values); }
    async first(column) {
      const row = sqlite.prepare(this.sql).get(...this.values);
      return row ? (column ? row[column] : { ...row }) : null;
    }
    async all() {
      return { results: sqlite.prepare(this.sql).all(...this.values).map(row => ({ ...row })), success: true };
    }
    async run() {
      const result = sqlite.prepare(this.sql).run(...this.values);
      return { success: true, meta: { changes: result.changes, last_row_id: result.lastInsertRowid } };
    }
  }
  return {
    prepare(sql) { return new Statement(sql); },
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
    close() { sqlite.close(); },
  };
}

function createR2() {
  const objects = new Map();
  return {
    objects,
    async put(key, bytes, options = {}) {
      objects.set(key, { bytes: new Uint8Array(bytes instanceof Blob ? await bytes.arrayBuffer() : bytes), ...options });
    },
    async head(key) {
      const object = objects.get(key);
      return object ? { size: object.bytes.length, customMetadata: object.customMetadata } : null;
    },
    async get(key) {
      const object = objects.get(key);
      if (!object) return null;
      return {
        body: object.bytes, size: object.bytes.length, customMetadata: object.customMetadata,
        httpEtag: '"mock-etag"',
        writeHttpMetadata(headers) { headers.set('content-type', object.httpMetadata.contentType); },
      };
    },
    async delete(key) { objects.delete(key); },
  };
}

function fixture(t) {
  const DB = createD1(), BUCKET = createR2(), env = { DB, BUCKET };
  t.after(() => DB.close());
  const handle = createHandler({}, [{ id: 'example', isExample: true }]);
  async function raw(path, { method = 'GET', user = 'ana', body, rawBody = false, origin = ORIGIN, headers = {} } = {}) {
    const h = new Headers(headers);
    if (user) {
      h.set('oai-authenticated-user-id', USERS[user].id);
      h.set('oai-authenticated-user-full-name', encodeURIComponent(USERS[user].name));
      h.set('oai-authenticated-user-full-name-encoding', 'percent-encoded-utf-8');
    }
    if (origin !== null) h.set('origin', origin);
    let requestBody = body;
    if (!rawBody && body !== undefined && !(body instanceof FormData)) {
      h.set('content-type', 'application/json');
      requestBody = JSON.stringify(body);
    }
    return handle(new Request(ORIGIN + path, { method, headers: h, body: requestBody }), env);
  }
  async function send(path, options) {
    const response = await raw(path, options);
    return { status: response.status, body: await response.json(), headers: response.headers };
  }
  async function upload(kind = 'image', { user = 'ana', type, bytes } = {}) {
    const isImage = kind === 'image';
    const form = new FormData();
    form.set('kind', kind);
    form.set('file', new File([bytes ?? (isImage ? new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]) : new Uint8Array([0, 0, 0, 20, 102, 116, 121, 112, 105, 115, 111, 109]))], 'test-file', { type: type ?? (isImage ? 'image/png' : 'video/mp4') }));
    return send('/api/upload', { method: 'POST', user, body: form });
  }
  return { send, raw, upload, DB, BUCKET, env };
}

test('cards persist, return decimal prices and owner state, update, and delete', async t => {
  const f = fixture(t);
  const created = await f.send('/api/cards', { method: 'POST', body: CARD });
  assert.equal(created.status, 201);
  assert.match(created.body.id, /^[a-f0-9-]{36}$/);
  let list = await f.send('/api/cards');
  assert.equal(list.status, 200);
  assert.equal(list.body.cards.length, 1);
  assert.equal(list.body.cards[0].value, 249.95);
  assert.equal(list.body.cards[0].author, USERS.ana.name);
  assert.equal(list.body.cards[0].isOwner, true);
  assert.equal(list.body.cards[0].isExample, false);
  assert.deepEqual(list.body.examples, [{ id: 'example', isExample: true }]);
  assert.equal((await f.send('/api/cards', { user: null })).body.cards[0].isOwner, false);

  assert.equal((await f.send('/api/cards/' + created.body.id, {
    method: 'PATCH', body: { ...CARD, name: 'Pikachu atualizado', value: 100.01 },
  })).status, 200);
  list = await f.send('/api/cards');
  assert.equal(list.body.cards[0].name, 'Pikachu atualizado');
  assert.equal(list.body.cards[0].value, 100.01);
  assert.equal((await f.send('/api/cards/' + created.body.id, { method: 'DELETE' })).status, 200);
  assert.deepEqual((await f.send('/api/cards')).body.cards, []);
  assert.equal((await f.send('/api/cards/' + created.body.id, { method: 'DELETE' })).status, 404);
});

test('authentication and same-origin checks protect every write route', async t => {
  const f = fixture(t);
  assert.deepEqual((await f.send('/api/me', { user: null })).body, { user: null });
  assert.deepEqual((await f.send('/api/me')).body.user, USERS.ana);
  for (const path of ['/api/cards', '/api/videos', '/api/upload']) {
    assert.equal((await f.send(path, { method: 'POST', user: null, body: {} })).status, 401, path);
    for (const origin of [null, 'https://other.test', 'null']) {
      assert.equal((await f.send(path, { method: 'POST', origin, body: {} })).status, 403, path + ': ' + origin);
    }
  }
  const created = await f.send('/api/cards', { method: 'POST', body: CARD });
  for (const method of ['PATCH', 'DELETE']) {
    assert.equal((await f.send('/api/cards/' + created.body.id, { method, user: null, body: method === 'PATCH' ? CARD : undefined })).status, 401);
    assert.equal((await f.send('/api/cards/' + created.body.id, { method, origin: 'https://other.test', body: method === 'PATCH' ? CARD : undefined })).status, 403);
  }
});

test('another user cannot edit or delete a card', async t => {
  const f = fixture(t);
  const { body: { id } } = await f.send('/api/cards', { method: 'POST', body: CARD });
  assert.equal((await f.send('/api/cards', { user: 'bruno' })).body.cards[0].isOwner, false);
  assert.equal((await f.send('/api/cards/' + id, { method: 'PATCH', user: 'bruno', body: { ...CARD, value: 0 } })).status, 403);
  assert.equal((await f.send('/api/cards/' + id, { method: 'DELETE', user: 'bruno' })).status, 403);
  assert.equal((await f.send('/api/cards')).body.cards[0].value, CARD.value);
});

test('invalid card fields are rejected without persisting a record', async t => {
  const f = fixture(t);
  for (const override of [{ name: ' ' }, { value: -1 }, { value: 'not-a-price' }, { value: 1000000000 }, { rarity: 'Inventada' }, { game: 'Outro jogo' }, { condition: 'Mint' }, { image: 'https://external.test/image.png' }]) {
    assert.equal((await f.send('/api/cards', { method: 'POST', body: { ...CARD, ...override } })).status, 400, JSON.stringify(override));
  }
  assert.deepEqual((await f.send('/api/cards')).body.cards, []);
});

test('card prices require an explicit number or nonempty numeric string, while zero remains valid', async t => {
  const f = fixture(t);
  for (const value of [undefined, null, '', '  ', [], [10], {}, true, false]) {
    const response = await f.send('/api/cards', { method: 'POST', body: { ...CARD, value } });
    assert.equal(response.status, 400, 'invalid value: ' + JSON.stringify(value));
  }
  assert.deepEqual((await f.send('/api/cards')).body.cards, []);
  for (const value of [0, '0', '25.99']) {
    const response = await f.send('/api/cards', { method: 'POST', body: { ...CARD, value } });
    assert.equal(response.status, 201, 'valid value: ' + JSON.stringify(value));
    const card = (await f.send('/api/cards')).body.cards.find(card => card.id === response.body.id);
    assert.equal(card.value, Number(value));
  }
});

test('malformed JSON and multipart requests return a client error without storing data', async t => {
  const f = fixture(t);
  for (const path of ['/api/cards', '/api/videos']) {
    for (const body of ['{"broken":', 'null', '[]', '5', 'true', '"text"']) {
      const response = await f.send(path, {
        method: 'POST', rawBody: true, body, headers: { 'content-type': 'application/json' },
      });
      assert.equal(response.status, 400, path + ': ' + body);
      assert.equal(typeof response.body.error, 'string');
    }
  }
  const response = await f.send('/api/upload', {
    method: 'POST', rawBody: true, body: 'not-a-multipart-body',
    headers: { 'content-type': 'multipart/form-data; boundary=missing-boundary' },
  });
  assert.equal(response.status, 400);
  assert.equal(typeof response.body.error, 'string');
  assert.equal(f.BUCKET.objects.size, 0);
  assert.deepEqual((await f.send('/api/cards')).body.cards, []);
  assert.deepEqual((await f.send('/api/videos')).body.videos, []);
});

test('replacing a card image removes the previous upload only after its final reference changes', async t => {
  const f = fixture(t);
  const firstImage = (await f.upload('image')).body.url;
  const secondImage = (await f.upload('image')).body.url;
  const thirdImage = (await f.upload('image')).body.url;
  const firstCard = (await f.send('/api/cards', { method: 'POST', body: { ...CARD, image: firstImage } })).body.id;
  const secondCard = (await f.send('/api/cards', { method: 'POST', body: { ...CARD, image: firstImage } })).body.id;
  assert.equal((await f.send('/api/cards/' + firstCard, { method: 'PATCH', body: { ...CARD, image: secondImage } })).status, 200);
  assert.notEqual(await f.BUCKET.head(firstImage.slice(7)), null, 'another card still uses the previous image');
  assert.equal((await f.send('/api/cards/' + secondCard, { method: 'PATCH', body: { ...CARD, image: thirdImage } })).status, 200);
  assert.equal(await f.BUCKET.head(firstImage.slice(7)), null, 'last reference to previous image was replaced');
  assert.notEqual(await f.BUCKET.head(secondImage.slice(7)), null);
  assert.equal((await f.send('/api/cards/' + firstCard, { method: 'PATCH', body: { ...CARD, image: secondImage, notes: 'Imagem mantida.' } })).status, 200);
  assert.notEqual(await f.BUCKET.head(secondImage.slice(7)), null, 'unchanged image remains available');
  assert.equal((await f.send('/api/cards/' + secondCard, { method: 'PATCH', body: { ...CARD, image: '' } })).status, 200);
  assert.equal(await f.BUCKET.head(thirdImage.slice(7)), null, 'removing an image also clears its unused upload');
});

test('YouTube and Vimeo URLs are normalized and unsupported hosts are rejected', async t => {
  const f = fixture(t);
  const allowed = [
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?t=10', 'youtube', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
    ['https://m.youtube.com/shorts/dQw4w9WgXcQ', 'youtube', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'youtube', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
    ['https://vimeo.com/123456789', 'vimeo', 'https://player.vimeo.com/video/123456789'],
  ];
  for (const [source, sourceType, normalized] of allowed) {
    const created = await f.send('/api/videos', { method: 'POST', body: { ...VIDEO, source } });
    assert.equal(created.status, 201, source);
    const video = (await f.send('/api/videos')).body.videos.find(v => v.id === created.body.id);
    assert.equal(video.source, normalized);
    assert.equal(video.sourceType, sourceType);
  }
  for (const source of ['https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ', 'https://evil.test/?v=dQw4w9WgXcQ', 'http://youtube.com/watch?v=dQw4w9WgXcQ', 'javascript:alert(1)', 'https://youtu.be/short', 'https://vimeo.com/not-a-number']) {
    assert.equal((await f.send('/api/videos', { method: 'POST', body: { ...VIDEO, source } })).status, 400, source);
  }
});

test('likes toggle per user, require authentication and same origin, and are removed with a video', async t => {
  const f = fixture(t);
  const { body: { id } } = await f.send('/api/videos', { method: 'POST', body: VIDEO });
  const like = '/api/videos/' + id + '/like';
  assert.equal((await f.send(like, { method: 'POST', user: null })).status, 401);
  assert.equal((await f.send(like, { method: 'POST', origin: 'https://other.test' })).status, 403);
  assert.deepEqual((await f.send(like, { method: 'POST' })).body, { liked: true });
  assert.deepEqual((await f.send(like, { method: 'POST', user: 'bruno' })).body, { liked: true });
  let video = (await f.send('/api/videos')).body.videos[0];
  assert.equal(video.likes, 2);
  assert.equal(video.liked, true);
  assert.equal((await f.send('/api/videos', { user: null })).body.videos[0].liked, false);
  assert.deepEqual((await f.send(like, { method: 'POST' })).body, { liked: false });
  video = (await f.send('/api/videos')).body.videos[0];
  assert.equal(video.likes, 1);
  assert.equal(video.liked, false);
  assert.equal((await f.send('/api/videos/' + id, { method: 'DELETE', user: 'bruno' })).status, 403);
  assert.equal((await f.send('/api/videos/' + id, { method: 'DELETE' })).status, 200);
  assert.deepEqual((await f.send('/api/videos')).body.videos, []);
  assert.equal((await f.DB.prepare('SELECT COUNT(*) AS count FROM video_likes').first()).count, 0);
  assert.equal((await f.send(like, { method: 'POST' })).status, 404);
});

test('uploads validate MIME, magic bytes, ownership, and the declared request limit', async t => {
  const f = fixture(t);
  assert.equal((await f.upload('image', { type: 'image/svg+xml', bytes: '<svg></svg>' })).status, 400);
  assert.equal((await f.upload('image', { type: 'image/png', bytes: 'not an image' })).status, 400);
  assert.equal((await f.upload('video', { type: 'video/mp4', bytes: 'not a video' })).status, 400);
  assert.equal((await f.upload('video', { type: 'text/html', bytes: '<p>hello</p>' })).status, 400);
  assert.equal((await f.upload('image', { bytes: new Uint8Array() })).status, 413);
  assert.equal((await f.send('/api/upload', { method: 'POST', body: {}, headers: { 'content-length': String(65 * 1024 * 1024) } })).status, 413);

  const uploaded = await f.upload();
  assert.equal(uploaded.status, 201);
  assert.match(uploaded.body.url, /^\/media\/image\/[a-f0-9-]{36}\.png$/);
  assert.equal((await f.BUCKET.head(uploaded.body.url.slice(7))).customMetadata.owner, USERS.ana.id);
  assert.equal((await f.send('/api/cards', { method: 'POST', user: 'bruno', body: { ...CARD, image: uploaded.body.url } })).status, 400);
  const card = await f.send('/api/cards', { method: 'POST', body: { ...CARD, image: uploaded.body.url } });
  assert.equal(card.status, 201);
  const media = await f.raw(uploaded.body.url, { user: null });
  assert.equal(media.status, 200);
  assert.equal(media.headers.get('content-type'), 'image/png');
  assert.equal((await media.arrayBuffer()).byteLength, 8);
  assert.equal((await f.send('/api/cards/' + card.body.id, { method: 'DELETE' })).status, 200);
  assert.equal(await f.BUCKET.head(uploaded.body.url.slice(7)), null);
});

test('video uploads and covers must belong to the publisher and are removed with their post', async t => {
  const f = fixture(t);
  const movie = await f.upload('video');
  const cover = await f.upload('image');
  assert.equal(movie.status, 201);
  const body = { ...VIDEO, sourceType: 'upload', source: movie.body.url, cover: cover.body.url };
  assert.equal((await f.send('/api/videos', { method: 'POST', user: 'bruno', body })).status, 400);
  const brunoMovie = await f.upload('video', { user: 'bruno' });
  assert.equal((await f.send('/api/videos', { method: 'POST', user: 'bruno', body: { ...body, source: brunoMovie.body.url } })).status, 400);
  assert.equal((await f.send('/api/videos', { method: 'POST', body: { ...body, source: '/media/video/00000000-0000-0000-0000-000000000000.mp4' } })).status, 400);
  const published = await f.send('/api/videos', { method: 'POST', body });
  assert.equal(published.status, 201);
  const video = (await f.send('/api/videos')).body.videos[0];
  assert.equal(video.sourceType, 'upload');
  assert.equal(video.source, movie.body.url);
  assert.equal(video.cover, cover.body.url);
  assert.equal((await f.send('/api/videos/' + published.body.id, { method: 'DELETE', user: 'bruno' })).status, 403);
  assert.notEqual(await f.BUCKET.head(movie.body.url.slice(7)), null);
  assert.equal((await f.send('/api/videos/' + published.body.id, { method: 'DELETE' })).status, 200);
  assert.equal(await f.BUCKET.head(movie.body.url.slice(7)), null);
  assert.equal(await f.BUCKET.head(cover.body.url.slice(7)), null);
});

test('deleting a publication preserves uploads referenced by other cards or videos', async t => {
  const f = fixture(t);
  const image = (await f.upload('image')).body.url;
  const source = (await f.upload('video')).body.url;
  const firstCard = (await f.send('/api/cards', { method: 'POST', body: { ...CARD, image } })).body.id;
  const secondCard = (await f.send('/api/cards', { method: 'POST', body: { ...CARD, image } })).body.id;
  const videoData = { ...VIDEO, sourceType: 'upload', source, cover: image };
  const firstVideo = (await f.send('/api/videos', { method: 'POST', body: videoData })).body.id;
  const secondVideo = (await f.send('/api/videos', { method: 'POST', body: videoData })).body.id;

  assert.equal((await f.send('/api/cards/' + firstCard, { method: 'DELETE' })).status, 200);
  assert.notEqual(await f.BUCKET.head(image.slice(7)), null, 'second card and video covers retain image');
  assert.equal((await f.send('/api/cards/' + secondCard, { method: 'DELETE' })).status, 200);
  assert.notEqual(await f.BUCKET.head(image.slice(7)), null, 'video covers retain image');
  assert.equal((await f.send('/api/videos/' + firstVideo, { method: 'DELETE' })).status, 200);
  assert.notEqual(await f.BUCKET.head(source.slice(7)), null, 'second video retains source');
  assert.notEqual(await f.BUCKET.head(image.slice(7)), null, 'second video retains cover');
  assert.equal((await f.send('/api/videos/' + secondVideo, { method: 'DELETE' })).status, 200);
  assert.equal(await f.BUCKET.head(source.slice(7)), null);
  assert.equal(await f.BUCKET.head(image.slice(7)), null);
});

test('unavailable storage returns an actionable service error', async t => {
  const f = fixture(t);
  delete f.env.BUCKET;
  assert.equal((await f.upload()).status, 503);
  delete f.env.DB;
  assert.equal((await f.send('/api/cards')).status, 503);
});

const PAGES_ORIGIN = 'https://kalebreus.github.io';

test('GitHub Pages reads public cards and videos without receiving account ownership or liked state', async t => {
  const f = fixture(t);
  const card = await f.send('/api/cards', { method: 'POST', body: CARD });
  const video = await f.send('/api/videos', { method: 'POST', body: VIDEO });
  assert.equal(card.status, 201);
  assert.equal(video.status, 201);
  await f.send('/api/videos/' + video.body.id + '/like', { method: 'POST' });
  for (const path of ['/api/cards', '/api/videos']) {
    const response = await f.send(path, {
      origin: PAGES_ORIGIN,
      headers: { cookie: 'session=existing-browser-session', authorization: 'Bearer example-user-token' },
    });
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get('access-control-allow-origin'), PAGES_ORIGIN);
    assert.equal(response.headers.get('access-control-allow-credentials'), null);
    assert.equal(response.headers.get('vary'), 'Origin');
    const entry = response.body[path === '/api/cards' ? 'cards' : 'videos'][0];
    assert.equal(entry.isOwner, false, path + ' must be anonymous even with injected identity headers');
    if (path === '/api/videos') {
      assert.equal(entry.likes, 1, 'public aggregate remains visible');
      assert.equal(entry.liked, false, 'private like state is not disclosed');
    }
  }
  assert.equal((await f.send('/api/cards')).body.cards[0].isOwner, true, 'same-origin session retains ownership');
  assert.equal((await f.send('/api/videos')).body.videos[0].liked, true, 'same-origin session retains like state');
});

test('GitHub Pages preflight is limited to GET on the public catalogue and feed', async t => {
  const f = fixture(t);
  for (const path of ['/api/cards', '/api/videos']) {
    const response = await f.raw(path, {
      method: 'OPTIONS', origin: PAGES_ORIGIN,
      headers: { 'access-control-request-method': 'GET', 'access-control-request-headers': 'content-type' },
    });
    assert.equal(response.status, 204, path);
    assert.equal(await response.text(), '');
    assert.equal(response.headers.get('access-control-allow-origin'), PAGES_ORIGIN);
    assert.equal(response.headers.get('access-control-allow-methods'), 'GET, OPTIONS');
    assert.equal(response.headers.get('access-control-allow-headers'), 'Content-Type');
    assert.equal(response.headers.get('access-control-allow-credentials'), null);
    assert.equal((await f.raw(path, {
      method: 'OPTIONS', origin: PAGES_ORIGIN,
      headers: { 'access-control-request-method': 'POST' },
    })).status, 403);
  }
  for (const path of ['/api/me', '/api/upload']) {
    assert.equal((await f.raw(path, {
      method: 'OPTIONS', origin: PAGES_ORIGIN,
      headers: { 'access-control-request-method': 'GET' },
    })).status, 403, path);
  }
});

test('GitHub Pages cannot read identity or perform card, video, upload and like mutations', async t => {
  const f = fixture(t);
  const cardId = (await f.send('/api/cards', { method: 'POST', body: CARD })).body.id;
  const videoId = (await f.send('/api/videos', { method: 'POST', body: VIDEO })).body.id;
  assert.equal((await f.send('/api/me', { origin: PAGES_ORIGIN })).status, 403);
  const operations = [
    ['/api/cards', 'POST', CARD],
    ['/api/cards/' + cardId, 'PATCH', { ...CARD, value: 0 }],
    ['/api/cards/' + cardId, 'DELETE'],
    ['/api/videos', 'POST', VIDEO],
    ['/api/videos/' + videoId, 'DELETE'],
    ['/api/videos/' + videoId + '/like', 'POST', {}],
    ['/api/upload', 'POST', {}],
  ];
  for (const [path, method, body] of operations) {
    const response = await f.send(path, { method, body, origin: PAGES_ORIGIN });
    assert.equal(response.status, 403, method + ' ' + path);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
  }
  const cards = (await f.send('/api/cards')).body.cards;
  const videos = (await f.send('/api/videos')).body.videos;
  assert.equal(cards.length, 1);
  assert.equal(cards[0].value, CARD.value);
  assert.equal(videos.length, 1);
  assert.equal(videos[0].likes, 0);
  assert.equal(f.BUCKET.objects.size, 0);
});

test('unrelated origins do not receive CORS access to the public APIs', async t => {
  const f = fixture(t);
  for (const origin of ['https://other.test', 'https://kalebreus.github.io.evil.test', 'null']) {
    for (const path of ['/api/cards', '/api/videos', '/api/me']) {
      const response = await f.send(path, { origin });
      assert.equal(response.status, 403, origin + ' ' + path);
      assert.equal(response.headers.get('access-control-allow-origin'), null);
    }
  }
});
