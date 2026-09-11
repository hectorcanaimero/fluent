import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { Feed } from '../../content/index.js';
import type { NewsItemUpsertRow, RssIngestRepository } from './rss-ingest.repository.js';
import { RssIngestService } from './rss-ingest.service.js';

const FEED_A_URL = 'https://example.com/feeds/feed-a.xml';
const FEED_B_URL = 'https://example.com/feeds/feed-b.xml';

const FEED_A_XML = readFileSync(
  fileURLToPath(new URL('../../../fixtures/rss/feed-a.xml', import.meta.url)),
  'utf-8',
);
const FEED_B_XML = readFileSync(
  fileURLToPath(new URL('../../../fixtures/rss/feed-b.xml', import.meta.url)),
  'utf-8',
);

const FEED_A: Feed = {
  name: 'Fixture Tech Feed',
  url: FEED_A_URL,
  tags: ['tech'],
  lang: 'en',
};

const FEED_B: Feed = {
  name: 'Fixture Sport & Science Feed',
  url: FEED_B_URL,
  tags: ['soccer'],
  lang: 'en',
};

/** Interés mínimo con los mismos tags/ids reales que usa `tags.ts` en producción. */
const TEST_INTERESTS = [
  { id: 'technology', tags: ['tech', 'coding', 'automation'] },
  { id: 'football', tags: ['soccer', 'competition', 'exploration'] },
  { id: 'space', tags: ['astronomy', 'exploration', 'discovery'] },
  { id: 'science', tags: ['research', 'discovery', 'biology'] },
  { id: 'artificial-intelligence', tags: ['ai', 'automation', 'research'] },
];

/** `fetchImpl` de mentira: sirve las fixtures XML por URL, sin tocar la red. */
function fakeFetch(routes: Record<string, string | 'network-error' | number>): typeof fetch {
  return (async (input: unknown) => {
    const url = String(input);
    const route = routes[url];
    if (route === undefined) {
      return new Response('not registered', { status: 404 });
    }
    if (route === 'network-error') {
      throw new Error(`network error fetching ${url}`);
    }
    if (typeof route === 'number') {
      return new Response('error', { status: route });
    }
    return new Response(route, { status: 200 });
  }) as unknown as typeof fetch;
}

/** Repositorio en memoria: `Map<url, row>` simula el `UNIQUE(url)` de la tabla. */
function makeRepository() {
  const rows = new Map<string, NewsItemUpsertRow>();
  const upsertItems = vi.fn(async (incoming: NewsItemUpsertRow[]) => {
    for (const row of incoming) rows.set(row.url, { ...row });
  });
  const deleteOlderThan = vi.fn(async (cutoffDay: string) => {
    let deleted = 0;
    for (const [url, row] of rows) {
      if (row.day < cutoffDay) {
        rows.delete(url);
        deleted += 1;
      }
    }
    return deleted;
  });
  const repository: RssIngestRepository = { upsertItems, deleteOlderThan };
  return { repository, rows, upsertItems, deleteOlderThan };
}

function makeService(overrides: {
  feeds?: Feed[];
  fetchImpl: typeof fetch;
  repository: RssIngestRepository;
  now?: () => Date;
  maxBytes?: number;
}) {
  return new RssIngestService({
    repository: overrides.repository,
    feeds: overrides.feeds ?? [FEED_A, FEED_B],
    interests: TEST_INTERESTS,
    fetchImpl: overrides.fetchImpl,
    maxBytes: overrides.maxBytes,
    now: overrides.now ?? (() => new Date('2026-09-08T06:00:00.000Z')),
  });
}

describe('RssIngestService', () => {
  it('procesa los 2 feeds de las fixtures y guarda los ítems con el shape correcto', async () => {
    const { repository, rows, upsertItems } = makeRepository();
    const fetchImpl = fakeFetch({ [FEED_A_URL]: FEED_A_XML, [FEED_B_URL]: FEED_B_XML });
    const service = makeService({ fetchImpl, repository });

    const result = await service.run();

    expect(result.feedsOk).toBe(2);
    expect(result.feedsFailed).toBe(0);
    expect(result.failures).toEqual([]);
    expect(result.itemsUpserted).toBe(8);
    expect(upsertItems).toHaveBeenCalledTimes(1);
    expect(rows.size).toBe(8);

    const aiChip = rows.get('https://example.com/tech/ai-chip');
    expect(aiChip).toBeDefined();
    expect(aiChip?.source).toBe('Fixture Tech Feed');
    expect(aiChip?.title).toBe('Breakthrough AI chip promises faster training');
    // summary limpio de HTML: sin etiquetas, con "&" ya decodificado.
    expect(aiChip?.summary).toBe(
      'Researchers unveiled a new AI chip that speeds up model training & cuts energy costs by half.',
    );
    expect(aiChip?.summary).not.toContain('<');
    // feed.tags (["tech"]) + keyword "ai" matcheada en el título.
    expect(aiChip?.tags).toEqual(['ai', 'tech']);
    expect(aiChip?.published_at).toBe('2026-09-01T08:00:00.000Z');
    expect(aiChip?.day).toBe('2026-09-08');

    const smartphone = rows.get('https://example.com/tech/smartphone');
    // "camera" (singular) no matchea la keyword "cameras": solo el tag del feed.
    expect(smartphone?.tags).toEqual(['tech']);

    const footballChamps = rows.get('https://example.com/sport/football-champs');
    // feed.tags (["soccer"]) + keyword "football" (id del interés, no tag).
    expect(footballChamps?.tags).toEqual(['football', 'soccer']);

    const spaceDiscovery = rows.get('https://example.com/science/space-discovery');
    expect(spaceDiscovery?.tags).toEqual(['discovery', 'exploration', 'soccer', 'space']);

    const ocean = rows.get('https://example.com/science/ocean');
    // sin coincidencias de keywords en el título: solo el tag del feed.
    expect(ocean?.tags).toEqual(['soccer']);
  });

  it('recorta el summary a 400 caracteres', async () => {
    const longDescription = 'x'.repeat(500);
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>Long</title>
      <item><title>Long item</title><link>https://example.com/long</link>
      <description><![CDATA[${longDescription}]]></description>
      <pubDate>Mon, 01 Sep 2026 08:00:00 GMT</pubDate></item>
    </channel></rss>`;
    const feed: Feed = { name: 'Long Feed', url: 'https://example.com/long-feed.xml', tags: [], lang: 'en' };
    const { repository, rows } = makeRepository();
    const fetchImpl = fakeFetch({ [feed.url]: xml });
    const service = makeService({ feeds: [feed], fetchImpl, repository });

    await service.run();

    const row = rows.get('https://example.com/long');
    expect(row?.summary).toHaveLength(400);
  });

  it('un feed que falla (network error) no detiene el job: el otro se procesa igual', async () => {
    const { repository, rows } = makeRepository();
    const fetchImpl = fakeFetch({
      [FEED_A_URL]: 'network-error',
      [FEED_B_URL]: FEED_B_XML,
    });
    const service = makeService({ fetchImpl, repository });

    const result = await service.run();

    expect(result.feedsOk).toBe(1);
    expect(result.feedsFailed).toBe(1);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.name).toBe('Fixture Tech Feed');
    expect(result.failures[0]?.error).toContain('network error');
    // Los 4 ítems del feed B sí se guardan.
    expect(rows.size).toBe(4);
  });

  it('un feed con HTTP no-ok tampoco detiene el job', async () => {
    const { repository, rows } = makeRepository();
    const fetchImpl = fakeFetch({
      [FEED_A_URL]: 500,
      [FEED_B_URL]: FEED_B_XML,
    });
    const service = makeService({ fetchImpl, repository });

    const result = await service.run();

    expect(result.feedsFailed).toBe(1);
    expect(result.failures[0]?.error).toContain('500');
    expect(rows.size).toBe(4);
  });

  it('una segunda ejecución no duplica (mismo número de filas, upsert por url)', async () => {
    const { repository, rows } = makeRepository();
    const fetchImpl = fakeFetch({ [FEED_A_URL]: FEED_A_XML, [FEED_B_URL]: FEED_B_XML });
    const service = makeService({ fetchImpl, repository });

    await service.run();
    const firstRunSize = rows.size;
    await service.run();

    expect(rows.size).toBe(firstRunSize);
    expect(rows.size).toBe(8);
  });

  it('borra los ítems con day < hoy - 14', async () => {
    const { repository, rows, deleteOlderThan } = makeRepository();
    // Sembrado directo: 2 ítems viejos (hace 20 días) y 1 reciente (ayer).
    rows.set('https://example.com/old-1', {
      source: 'Old Feed',
      url: 'https://example.com/old-1',
      title: 'Old news 1',
      summary: null,
      tags: [],
      published_at: null,
      day: '2026-08-19', // hoy (2026-09-08) - 20 días
    });
    rows.set('https://example.com/old-2', {
      source: 'Old Feed',
      url: 'https://example.com/old-2',
      title: 'Old news 2',
      summary: null,
      tags: [],
      published_at: null,
      day: '2026-08-20', // hoy - 19 días
    });
    rows.set('https://example.com/recent', {
      source: 'Old Feed',
      url: 'https://example.com/recent',
      title: 'Recent news',
      summary: null,
      tags: [],
      published_at: null,
      day: '2026-09-07', // ayer
    });

    const fetchImpl = fakeFetch({ [FEED_A_URL]: FEED_A_XML, [FEED_B_URL]: FEED_B_XML });
    const service = makeService({ feeds: [], fetchImpl, repository });

    const result = await service.run();

    expect(deleteOlderThan).toHaveBeenCalledWith('2026-08-25'); // hoy - 14 días
    expect(rows.has('https://example.com/old-1')).toBe(false);
    expect(rows.has('https://example.com/old-2')).toBe(false);
    expect(rows.has('https://example.com/recent')).toBe(true);
    expect(result.itemsDeleted).toBe(2);
  });

  it('aborta un feed que pasa del tope de bytes y lo cuenta como fallo (MEJ-36)', async () => {
    const { repository, upsertItems } = makeRepository();
    const huge = `<rss><channel>${'<!-- relleno -->'.repeat(4000)}</channel></rss>`;
    const fetchImpl = fakeFetch({ [FEED_A_URL]: huge });
    const service = makeService({
      feeds: [FEED_A],
      fetchImpl,
      repository,
      maxBytes: 1024,
    });

    const result = await service.run();

    expect(result.feedsOk).toBe(0);
    expect(result.feedsFailed).toBe(1);
    expect(result.failures[0]!.error).toContain('supera el máximo de 1024 bytes');
    // Nada que guardar: el feed no llegó a parsearse.
    expect(upsertItems).not.toHaveBeenCalled();
  });

  it('un feed por debajo del tope se procesa con normalidad (MEJ-36)', async () => {
    const { repository } = makeRepository();
    const fetchImpl = fakeFetch({ [FEED_A_URL]: FEED_A_XML });
    const service = makeService({
      feeds: [FEED_A],
      fetchImpl,
      repository,
      maxBytes: 1024 * 1024,
    });

    const result = await service.run();

    expect(result.feedsOk).toBe(1);
    expect(result.feedsFailed).toBe(0);
  });

  it('todos los feeds de producción usan https (MEJ-36)', async () => {
    const { FEEDS } = await import('../../content/index.js');

    for (const feed of FEEDS) {
      expect(feed.url.startsWith('https://'), `${feed.name}: ${feed.url}`).toBe(true);
    }
  });
});