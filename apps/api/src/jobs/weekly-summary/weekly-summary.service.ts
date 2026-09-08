/**
 * Job `weekly-summary` (SPEC-05 §4, RF-6.3).
 *
 * Entrada: `{ groupId, weekStart }` (lunes de la semana que acaba de
 * terminar). Pasos:
 *   1. Si ya existe fila en `weekly_summaries` para `(groupId, weekStart)`,
 *      salir sin llamar al LLM (el `UNIQUE` de la tabla ya lo garantiza a
 *      nivel de datos; este chequeo solo evita gastar la llamada al LLM).
 *   2. `stats` por miembro: XP y sesiones de `weekly_leaderboard`, top 3
 *      temas de `sessions` agregados en TypeScript (`top-topics.ts`), y
 *      `groupStreak` de `groups.group_streak`.
 *   3. Credencial: la del owner del grupo para el rol `brief`. Sin owner o
 *      sin credencial activa, se marca la incidencia (Redis, ver
 *      `pending-credential.store.ts`) y se lanza para que BullMQ reintente
 *      (SPEC-05 §4 paso 3).
 *   4. `LlmService.complete` con `buildWeeklyMessages` y `WeeklyOutput`.
 *      Guarda `text` y `stats` en `weekly_summaries`.
 *
 * Si el LLM se agota tras la cadena de fallback, `LlmService` lanza
 * `LlmUnavailableError` y aquí se deja propagar, igual que hace
 * `coaching-brief`: BullMQ aplica los reintentos con backoff de la cola
 * `social` (SPEC-05 §1).
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../../config/env.js';
import { CredentialsCrypto } from '../../credentials/credentials.crypto.js';
import { LlmService } from '../../llm/llm.service.js';
import type { ActiveCredential, ModelPreference } from '../../llm/model-resolver.js';
import { buildWeeklyMessages, type WeeklyMember } from '../../llm/prompts/weekly.js';
import { WeeklyOutput } from '../../llm/schemas.js';
import type { Locale } from '../../db/schema.js';
import { WeeklySummaryPendingCredentialStore } from './pending-credential.store.js';
import { computeTopTopics } from './top-topics.js';
import { WeeklySummaryRepository } from './weekly-summary.repository.js';

/**
 * SPEC-03 §4.3 escribe `{summary_language}` según el locale del owner (ver
 * `llm/prompts/weekly.ts`). Ni SPEC-01 ni SPEC-05 dicen qué hacer si el
 * owner (que ya sabemos que existe y tiene credencial activa en este punto)
 * no tiene fila en `profiles` — caso extremo no cubierto por ninguna spec.
 * Se usa `es` como valor por defecto, documentado en pendientes/PR-05.md.
 */
const FALLBACK_OWNER_LOCALE: Locale = 'es';

export type WeeklySummaryStatus = 'applied' | 'skipped';

export interface WeeklySummaryJobResult {
  readonly status: WeeklySummaryStatus;
  /** Presente cuando `status = 'skipped'`. */
  readonly reason?: 'already_exists' | 'group_not_found';
  readonly provider?: string;
  readonly modelUsed?: string;
  readonly degraded?: boolean;
  readonly membersCount?: number;
}

/**
 * Se lanza cuando el owner del grupo no tiene credencial activa (o no hay
 * owner). El processor la deja propagar para que BullMQ reintente, igual que
 * `LlmUnavailableError` en `coaching-brief` (SPEC-05 §4 paso 3).
 */
export class WeeklySummaryNoOwnerCredentialError extends Error {
  readonly name = 'WeeklySummaryNoOwnerCredentialError';
  readonly code = 'NO_OWNER_CREDENTIAL';

  constructor(
    readonly groupId: string,
    readonly weekStart: string,
    message: string,
  ) {
    super(message);
  }
}

@Injectable()
export class WeeklySummaryService {
  private readonly logger = new Logger(WeeklySummaryService.name);
  private readonly promptVersion: string;

  constructor(
    private readonly repository: WeeklySummaryRepository,
    private readonly crypto: CredentialsCrypto,
    private readonly llm: LlmService,
    private readonly pendingCredentials: WeeklySummaryPendingCredentialStore,
    configService: ConfigService<Env, true>,
  ) {
    this.promptVersion = String(
      configService.get('PROMPT_VERSION', { infer: true }),
    );
  }

  async run(groupId: string, weekStart: string): Promise<WeeklySummaryJobResult> {
    // --- 1. Idempotencia ------------------------------------------------
    if (await this.repository.summaryExists(groupId, weekStart)) {
      return { status: 'skipped', reason: 'already_exists' };
    }

    const group = await this.repository.loadGroup(groupId);
    if (!group) {
      this.logger.warn(`Grupo ${groupId} inexistente; nada que hacer`);
      return { status: 'skipped', reason: 'group_not_found' };
    }

    // --- 2. Credencial del owner -----------------------------------------
    // Se comprueba antes de construir `stats` para no gastar las lecturas de
    // `weekly_leaderboard`/`sessions` si el job va a fallar de todos modos.
    if (!group.owner_id) {
      // Sin owner (cuenta borrada, ver pendientes/PR-01 §1) no hay a quién
      // avisar por `pendingActions`: no hay clave de Redis que escribir.
      this.logger.warn(
        `Grupo ${groupId} sin owner_id; no se puede elegir credencial`,
      );
      throw new WeeklySummaryNoOwnerCredentialError(
        groupId,
        weekStart,
        `El grupo ${groupId} no tiene owner`,
      );
    }
    const ownerId = group.owner_id;

    const credentialRows = await this.repository.loadOwnerActiveCredentials(ownerId);
    const credentials: ActiveCredential[] = [];
    for (const row of credentialRows) {
      try {
        credentials.push({
          provider: row.provider,
          apiKey: this.crypto.decrypt(ownerId, row.provider, row),
        });
      } catch (error) {
        // Nunca se registra la clave, solo el proveedor y el motivo.
        this.logger.warn(
          `Credencial de ${row.provider} del owner ${ownerId} ilegible: ${
            (error as Error).message
          }`,
        );
      }
    }

    if (credentials.length === 0) {
      await this.pendingCredentials.markMissing(ownerId, { groupId, weekStart });
      throw new WeeklySummaryNoOwnerCredentialError(
        groupId,
        weekStart,
        `El owner ${ownerId} del grupo ${groupId} no tiene credencial activa`,
      );
    }

    // --- 3. stats por miembro ---------------------------------------------
    const leaderboard = await this.repository.loadLeaderboard(groupId, weekStart);
    const members: WeeklyMember[] = await Promise.all(
      leaderboard.map(async (entry) => {
        const [topics, streak] = await Promise.all([
          this.repository.loadMemberTopics(entry.user_id, weekStart),
          this.repository.loadMemberStreak(entry.user_id),
        ]);
        return {
          name: entry.display_name,
          xpWeek: entry.xp,
          sessionsWeek: entry.sessions,
          streak,
          topTopics: computeTopTopics(topics),
        } satisfies WeeklyMember;
      }),
    );

    const [preferenceRow, ownerLocale] = await Promise.all([
      this.repository.loadOwnerModelPreference(ownerId),
      this.repository.loadOwnerLocale(ownerId),
    ]);
    const preference: ModelPreference | null = preferenceRow
      ? { provider: preferenceRow.brief_provider, model: preferenceRow.brief_model }
      : null;

    // --- 4. LLM -------------------------------------------------------------
    const messages = buildWeeklyMessages({
      ownerLocale: ownerLocale ?? FALLBACK_OWNER_LOCALE,
      members,
      groupStreak: group.group_streak,
      weekStart,
    });

    const result = await this.llm.complete({
      userId: ownerId,
      purpose: 'weekly',
      messages,
      schema: WeeklyOutput,
      credentials,
      preference,
      promptVersion: this.promptVersion,
    });

    await this.repository.insertWeeklySummary({
      group_id: groupId,
      week_start: weekStart,
      text: result.data.text,
      stats: { members, groupStreak: group.group_streak, weekStart },
    });

    // Limpieza tras éxito (ver pending-credential.store.ts): si quedaba una
    // clave pendiente de una semana anterior, ya no aplica.
    await this.pendingCredentials.clear(ownerId);

    return {
      status: 'applied',
      provider: result.provider,
      modelUsed: result.modelUsed,
      degraded: result.degraded,
      membersCount: members.length,
    };
  }
}
