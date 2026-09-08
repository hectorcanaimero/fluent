/**
 * Acceso a datos del job `rss-ingest` (SPEC-05 §3).
 *
 * Mismo patrón que `coaching-brief.repository.ts`: clase abstracta como
 * contrato/token de inyección, implementación contra InsForge (PostgREST)
 * con el cliente admin, y una superficie estrecha (solo lo que necesita este
 * job, no un repositorio genérico de `news_items`).
 */
import { Inject, Injectable } from '@nestjs/common';
import type { InsForgeClient } from '@insforge/sdk';

import { INSFORGE_ADMIN_CLIENT } from '../../insforge/insforge.constants.js';
import { TABLES } from '../../db/schema.js';

/**
 * Fila a upsertar en `news_items`. Sin `id`: lo genera la base cuando es un
 * `insert`, y en un `update` (conflicto por `url`) no se toca.
 */
export interface NewsItemUpsertRow {
  readonly source: string;
  readonly url: string;
  readonly title: string;
  readonly summary: string | null;
  readonly tags: string[];
  readonly published_at: string | null;
  readonly day: string;
}

@Injectable()
export abstract class RssIngestRepository {
  /**
   * Upsert por `url` (`UNIQUE(url)` en la migración de `news_items`, PEND-14
   * de docs/specs/pendientes/PR-05.md sobre por qué upsert real y no
   * insert+update).
   */
  abstract upsertItems(rows: NewsItemUpsertRow[]): Promise<void>;
  /** Borra `news_items` con `day < cutoffDay` (SPEC-05 §3 paso 4). Devuelve cuántas filas borró. */
  abstract deleteOlderThan(cutoffDay: string): Promise<number>;
}

/* ============================================================================
   Implementación contra InsForge (PostgREST) con el cliente admin
   ========================================================================== */

interface PostgrestLike<T> {
  data: T | null;
  error: { message?: string } | null;
  count?: number | null;
}

function unwrap<T>(result: PostgrestLike<T>, what: string): T | null {
  if (result.error) {
    throw new Error(
      `InsForge falló al ${what}: ${result.error.message ?? 'error desconocido'}`,
    );
  }
  return result.data;
}

@Injectable()
export class InsforgeRssIngestRepository extends RssIngestRepository {
  constructor(
    @Inject(INSFORGE_ADMIN_CLIENT) private readonly client: InsForgeClient,
  ) {
    super();
  }

  private get db() {
    return this.client.database;
  }

  async upsertItems(rows: NewsItemUpsertRow[]): Promise<void> {
    if (rows.length === 0) return;
    const result = await this.db
      .from(TABLES.newsItems)
      .upsert(rows as unknown as Record<string, unknown>[], { onConflict: 'url' });
    unwrap(result as PostgrestLike<unknown>, 'upsertar noticias');
  }

  async deleteOlderThan(cutoffDay: string): Promise<number> {
    const result = await this.db
      .from(TABLES.newsItems)
      .delete({ count: 'exact' })
      .lt('day', cutoffDay);
    unwrap(result as PostgrestLike<unknown>, 'borrar noticias antiguas');
    return (result as PostgrestLike<unknown>).count ?? 0;
  }
}
