/**
 * Job `rss-ingest` (SPEC-05 §3, RF-7.1).
 *
 * Clase pura, sin decorador de Nest (mismo patrón que `LlmService` de
 * PR-03/`ModelCatalogService`: se construye con un `useFactory` en el
 * módulo). `fetchImpl` se inyecta por constructor, igual que
 * `ModelCatalogService`, así los tests pasan un `fetchImpl` de mentira que
 * sirve las fixtures sin tocar la red — nunca `parser.parseURL(url)`
 * directamente, que hace su propio `fetch` interno y es difícil de
 * interceptar en tests.
 *
 * 1. Por cada feed de `FEEDS`: descarga con timeout 10 s, parsea con
 *    `rss-parser`, toma los 15 más recientes.
 * 2. Por ítem: `url` = `item.link`; `summary` limpio de HTML y recortado a
 *    400 caracteres; `tags` = tags del feed + palabras clave del catálogo de
 *    intereses que aparecen en el título (ver `tags.ts`).
 * 3. Upsert en `news_items` con `day` = hoy (UTC).
 * 4. Borra ítems con `day < hoy - 14`.
 *
 * Si un feed falla (timeout, HTTP no-ok, XML inválido) se loguea y se sigue
 * con los demás: SPEC-05 §3 no dice qué hacer con un fallo individual, y
 * abortar los 7 feeds restantes por uno caído sería peor que servir un
 * ingest parcial (PEND-11 de docs/specs/pendientes/PR-05.md).
 */
import Parser from 'rss-parser';

import { FEEDS, INTERESTS, type Feed, type Interest } from '../../content/index.js';
import { stripHtml } from './html.js';
import type { NewsItemUpsertRow, RssIngestRepository } from './rss-ingest.repository.js';
import { buildInterestKeywords, matchInterestTags } from './tags.js';

/** SPEC-05 §3 paso 2: «recortada a 400 caracteres». */
const MAX_SUMMARY_LENGTH = 400;
/** SPEC-05 §3 paso 1: «tomar los 15 más recientes». */
const DEFAULT_ITEMS_PER_FEED = 15;
/** SPEC-05 §3 paso 4: «borrar ítems con day < hoy - 14». */
const DEFAULT_RETENTION_DAYS = 14;
/** SPEC-05 §3 paso 1: «descargar con timeout 10 s». */
const DEFAULT_TIMEOUT_MS = 10_000;

export interface RssIngestFeedFailure {
  readonly name: string;
  readonly url: string;
  readonly error: string;
}

export interface RssIngestJobResult {
  readonly feedsOk: number;
  readonly feedsFailed: number;
  readonly failures: RssIngestFeedFailure[];
  readonly itemsUpserted: number;
  readonly itemsDeleted: number;
}

export interface RssIngestServiceOptions {
  readonly repository: RssIngestRepository;
  /** Por defecto `FEEDS` (apps/api/src/content/feeds.json). Override solo para tests. */
  readonly feeds?: readonly Feed[];
  /** Por defecto `INTERESTS`. Override solo para tests. */
  readonly interests?: readonly Interest[];
  readonly fetchImpl?: typeof fetch;
  /** Reloj inyectable para que los tests fijen "hoy". Por defecto `() => new Date()`. */
  readonly now?: () => Date;
  readonly itemsPerFeed?: number;
  readonly retentionDays?: number;
  readonly timeoutMs?: number;
}

export class RssIngestService {
  private readonly repository: RssIngestRepository;
  private readonly feeds: readonly Feed[];
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;
  private readonly keywords: ReadonlySet<string>;
  private readonly itemsPerFeed: number;
  private readonly retentionDays: number;
  private readonly timeoutMs: number;
  private readonly parser = new Parser();

  constructor(options: RssIngestServiceOptions) {
    this.repository = options.repository;
    this.feeds = options.feeds ?? FEEDS;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.now = options.now ?? (() => new Date());
    this.keywords = buildInterestKeywords(options.interests ?? INTERESTS);
    this.itemsPerFeed = options.itemsPerFeed ?? DEFAULT_ITEMS_PER_FEED;
    this.retentionDays = options.retentionDays ?? DEFAULT_RETENTION_DAYS;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async run(): Promise<RssIngestJobResult> {
    const today = this.todayUtc();
    const rows: NewsItemUpsertRow[] = [];
    const failures: RssIngestFeedFailure[] = [];
    let feedsOk = 0;

    for (const feed of this.feeds) {
      try {
        const xml = await this.downloadFeed(feed.url);
        const parsed = await this.parser.parseString(xml);
        const items = (parsed.items ?? []).slice(0, this.itemsPerFeed);
        for (const item of items) {
          const row = this.buildRow(feed, item, today);
          if (row) rows.push(row);
        }
        feedsOk += 1;
      } catch (error) {
        failures.push({
          name: feed.name,
          url: feed.url,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Deduplicar por `url` dentro de la misma pasada: dos feeds distintos
    // podrían enlazar el mismo artículo, y `upsert` con filas duplicadas de
    // `url` en el mismo lote falla en Postgres ("ON CONFLICT DO UPDATE
    // command cannot affect row a second time"). Se queda la última.
    const byUrl = new Map<string, NewsItemUpsertRow>();
    for (const row of rows) byUrl.set(row.url, row);
    const dedupedRows = [...byUrl.values()];

    if (dedupedRows.length > 0) {
      await this.repository.upsertItems(dedupedRows);
    }

    const cutoffDay = this.cutoffDay(today);
    const itemsDeleted = await this.repository.deleteOlderThan(cutoffDay);

    return {
      feedsOk,
      feedsFailed: failures.length,
      failures,
      itemsUpserted: dedupedRows.length,
      itemsDeleted,
    };
  }

  private todayUtc(): string {
    return this.now().toISOString().slice(0, 10);
  }

  private cutoffDay(today: string): string {
    const date = new Date(`${today}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() - this.retentionDays);
    return date.toISOString().slice(0, 10);
  }

  private async downloadFeed(url: string): Promise<string> {
    const response = await this.fetchImpl(url, {
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`respuesta HTTP ${response.status} al descargar ${url}`);
    }
    return response.text();
  }

  private buildRow(
    feed: Feed,
    item: Parser.Item,
    day: string,
  ): NewsItemUpsertRow | null {
    const url = item.link ?? item.guid;
    if (!url) return null;

    const title = item.title?.trim() || '(sin título)';

    return {
      source: feed.name,
      url,
      title,
      summary: this.buildSummary(item),
      tags: this.buildTags(feed, title),
      published_at: this.parsePublishedAt(item),
      day,
    };
  }

  private buildSummary(item: Parser.Item): string | null {
    const raw =
      item.contentSnippet !== undefined && item.contentSnippet.trim().length > 0
        ? item.contentSnippet
        : stripHtml(item.content ?? item.summary ?? '');
    const trimmed = raw.trim();
    if (trimmed.length === 0) return null;
    return trimmed.slice(0, MAX_SUMMARY_LENGTH);
  }

  private buildTags(feed: Feed, title: string): string[] {
    const matched = matchInterestTags(title, this.keywords);
    return [...new Set([...feed.tags, ...matched])].sort();
  }

  private parsePublishedAt(item: Parser.Item): string | null {
    const raw = item.isoDate ?? item.pubDate;
    if (!raw) return null;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  }
}
