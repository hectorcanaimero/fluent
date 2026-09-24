import { Inject, Injectable } from '@nestjs/common';
import type { InsForgeClient } from '@insforge/sdk';
import { INSFORGE_ADMIN_CLIENT } from '../insforge/insforge.constants.js';
import { TABLES, type CoachingBrief, type Fact, type FactStatus } from '../db/schema.js';
import { unwrapInsforge } from '../insforge/insforge-result.js';

/** Columnas que `PATCH /memory/facts/:id` puede tocar (SPEC-02 §4.4). */
export interface FactPatch {
  status?: Extract<FactStatus, 'confirmed' | 'dismissed'>;
  text?: string;
}

/**
 * Repositorio de `facts`, `coaching_briefs` y `coaching_brief_history`
 * (SPEC-01 §2.9, §2.10) sobre el cliente admin de InsForge.
 *
 * **Aislamiento entre usuarios (crítico, alcance de T6):** la clave admin no
 * aplica RLS, así que cada UPDATE/DELETE de un hecho concreto filtra
 * **siempre** por `id` **y** `user_id` a la vez, nunca por `id` a secas —
 * nunca por `id` a secas. Un hecho
 * de otro usuario simplemente no matchea ninguna fila y el método devuelve
 * `null`/`false`, que el servicio traduce a `403 FORBIDDEN` (PEND-42).
 */
@Injectable()
export class MemoryRepository {
  constructor(@Inject(INSFORGE_ADMIN_CLIENT) private readonly admin: InsForgeClient) {}

  /**
   * Hechos no descartados del usuario (`GET /memory`, RF-4.2): la sección
   * "Para confirmar" y "Lo que recuerdo" de SPEC-06 §4.5 no muestran los
   * `dismissed` (PEND-45), así que se excluyen aquí para no traer filas de
   * más. Orden: más recientes primero (la spec no fija un orden, PEND-45).
   */
  async listActiveFacts(userId: string): Promise<Fact[]> {
    const result = await this.admin.database
      .from(TABLES.facts)
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'dismissed')
      .order('created_at', { ascending: false });

    return unwrapInsforge<Fact[]>(result) ?? [];
  }

  /**
   * Actualiza un hecho **solo si es del usuario** (filtro doble `id` +
   * `user_id`). `null` si no existe o pertenece a otro usuario: el llamador
   * no puede (ni debe) distinguir los dos casos con la clave admin.
   */
  async updateFact(userId: string, factId: string, patch: FactPatch): Promise<Fact | null> {
    const result = await this.admin.database
      .from(TABLES.facts)
      .update(patch)
      .eq('id', factId)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle();

    return unwrapInsforge<Fact>(result);
  }

  /** Borra un hecho **solo si es del usuario** (mismo filtro doble). `true` si borró algo. */
  async deleteFact(userId: string, factId: string): Promise<boolean> {
    const result = await this.admin.database
      .from(TABLES.facts)
      .delete()
      .eq('id', factId)
      .eq('user_id', userId)
      .select('id');

    const rows = unwrapInsforge<{ id: string }[]>(result) ?? [];
    return rows.length > 0;
  }

  /** Brief del usuario, o `null` si todavía no tiene fila. */
  async getBrief(userId: string): Promise<CoachingBrief | null> {
    const result = await this.admin.database
      .from(TABLES.coachingBriefs)
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    return unwrapInsforge<CoachingBrief>(result);
  }

  /**
   * Crea o actualiza el `text` del brief del usuario (`PUT /memory/brief`,
   * SPEC-02 §4.4). Solo toca `text`: `level_hint`, `recurring_errors` y
   * `source_session_id` son cosa de `apply_brief` (PR-01 §21), no de esta
   * edición manual (PEND-44). UPDATE primero e INSERT si no había fila
   * (evita depender de `upsert`
   * de PostgREST y resuelve la carrera de dos escrituras concurrentes con la
   * violación de UNIQUE de la PK `user_id`).
   */
  async upsertBriefText(userId: string, text: string): Promise<CoachingBrief> {
    const updated = await this.updateBriefText(userId, text);
    if (updated) {
      return updated;
    }

    const insertResult = await this.admin.database
      .from(TABLES.coachingBriefs)
      .insert({ user_id: userId, text })
      .select('*')
      .maybeSingle();

    if (insertResult.error) {
      // Carrera: otra petición concurrente ya creó la fila entre el UPDATE
      // (sin filas) y este INSERT (violación de UNIQUE de la PK `user_id`).
      const raced = await this.updateBriefText(userId, text);
      if (raced) {
        return raced;
      }
    }

    const created = unwrapInsforge<CoachingBrief>(insertResult);
    if (created === null) {
      throw new Error('upsertBriefText: la escritura no devolvió ninguna fila');
    }
    return created;
  }

  /**
   * Borra los datos de memoria del usuario (`DELETE /memory`, SPEC-02 §4.4:
   * «borra hechos, brief e historial»): `facts`, `coaching_briefs` y
   * `coaching_brief_history`. No toca `sessions` ni ninguna otra tabla —
   * "historial" aquí es el histórico de briefs, no las sesiones (PEND-44).
   */
  async purgeAll(userId: string): Promise<void> {
    await this.deleteWhereUserId(TABLES.facts, userId);
    await this.deleteWhereUserId(TABLES.coachingBriefHistory, userId);
    await this.deleteWhereUserId(TABLES.coachingBriefs, userId);
  }

  private async updateBriefText(userId: string, text: string): Promise<CoachingBrief | null> {
    const result = await this.admin.database
      .from(TABLES.coachingBriefs)
      .update({ text })
      .eq('user_id', userId)
      .select('*')
      .maybeSingle();

    return unwrapInsforge<CoachingBrief>(result);
  }

  private async deleteWhereUserId(table: string, userId: string): Promise<void> {
    const result = await this.admin.database.from(table).delete().eq('user_id', userId);
    if (result.error) {
      throw new Error(
        `MemoryRepository: no se pudieron borrar las filas de '${table}': ${result.error.message}`,
        { cause: result.error },
      );
    }
  }
}
