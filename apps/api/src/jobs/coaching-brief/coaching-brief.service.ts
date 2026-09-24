/**
 * Job `coaching-brief` (SPEC-05 §2, RF-4.1, RF-4.5, RF-4.7).
 *
 * Entrada: `{ sessionId }`. Pasos:
 *   1. Cargar sesión; si `brief_job_status = 'done'` salir. Marcar `running`.
 *   2. Cargar turnos, brief actual, hechos `confirmed` y `pending`, y las
 *      preferencias de modelo del rol `brief`.
 *   3. Llamar al LLM con el prompt de SPEC-03 §4.2 y el schema `BriefOutput`.
 *   4. RPC `apply_brief` (transacción: archiva, upsert, hechos, sesión `done`).
 *   5. Regla de nivel: tres `level_hint` consecutivos distintos del nivel del
 *      perfil → `profiles.suggested_level`.
 *
 * Si el LLM se agota tras la cadena de fallback, `LlmService` lanza
 * `LlmUnavailableError` y aquí se deja propagar: BullMQ aplica los reintentos
 * con backoff de la cola `brief` (SPEC-05 §1). La sesión queda en `running`, y
 * como no es `'done'` el siguiente intento vuelve a procesarla.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../../config/env.js';
import type { Level } from '../../db/schema.js';
import type { BriefFactInput } from '../../db/rpc.js';
import type { Provider as LlmProvider } from '../../llm/config.js';
import { LlmService } from '../../llm/llm.service.js';
import type { ModelPreference } from '../../llm/model-resolver.js';
import { buildBriefMessages } from '../../llm/prompts/brief.js';
import type { HistoryTurn } from '../../llm/prompts/truncate.js';
import { BriefOutput } from '../../llm/schemas.js';
import { effectivePlan } from '../../profiles/plan.js';
import { CoachingBriefRepository } from './coaching-brief.repository.js';
import { CONSECUTIVE_PREVIOUS_HINTS, levelToSuggest } from './level-rule.js';

export type CoachingBriefStatus = 'applied' | 'skipped';

export interface CoachingBriefJobResult {
  readonly status: CoachingBriefStatus;
  /** Presente cuando `status = 'skipped'`. */
  readonly reason?: 'already_done' | 'session_not_found' | 'not_applied';
  readonly factsInserted?: number;
  readonly factsSkipped?: number;
  readonly provider?: string;
  readonly modelUsed?: string;
  readonly degraded?: boolean;
  /** Nivel escrito en `profiles.suggested_level`, si la regla se disparó. */
  readonly suggestedLevel?: Level | null;
}

@Injectable()
export class CoachingBriefService {
  private readonly logger = new Logger(CoachingBriefService.name);
  private readonly promptVersion: string;

  constructor(
    private readonly repository: CoachingBriefRepository,
    private readonly llm: LlmService,
    configService: ConfigService<Env, true>,
  ) {
    this.promptVersion = String(
      configService.get('PROMPT_VERSION', { infer: true }),
    );
  }

  /**
   * Marca la sesión como `failed` (MAL-20). Lo llama el processor cuando el
   * job agota sus reintentos; vive aquí y no en el processor para que este
   * siga sin conocer el repositorio.
   */
  async markFailed(sessionId: string): Promise<void> {
    await this.repository.markSessionFailed(sessionId);
  }

  async run(sessionId: string): Promise<CoachingBriefJobResult> {
    // --- 1. Sesión e idempotencia ------------------------------------------
    const session = await this.repository.loadSession(sessionId);
    if (!session) {
      this.logger.warn(`Sesión ${sessionId} inexistente; nada que hacer`);
      return { status: 'skipped', reason: 'session_not_found' };
    }
    if (session.brief_job_status === 'done') {
      return { status: 'skipped', reason: 'already_done' };
    }

    await this.repository.markSessionRunning(sessionId);

    // --- 2. Contexto --------------------------------------------------------
    const userId = session.user_id;
    const [turns, profile, previousBrief, knownFacts, preferenceRow] = await Promise.all([
      this.repository.loadTurns(sessionId),
      this.repository.loadProfile(userId),
      this.repository.loadCurrentBriefText(userId),
      this.repository.loadKnownFacts(userId),
      this.repository.loadModelPreference(userId),
    ]);

    if (!profile) {
      throw new Error(`El usuario ${userId} de la sesión ${sessionId} no tiene perfil`);
    }

    const preference: ModelPreference | null = preferenceRow
      ? { provider: preferenceRow.brief_provider as LlmProvider, model: preferenceRow.brief_model }
      : null;

    // --- 3. LLM -------------------------------------------------------------
    const history: HistoryTurn[] = turns.map((turn) => ({
      role: turn.role,
      text: turn.text,
    }));

    const messages = buildBriefMessages({
      locale: profile.locale,
      level: profile.level,
      previousBrief,
      knownFacts,
      kind: session.kind,
      topic: session.topic,
      turns: history,
    });

    const result = await this.llm.complete({
      userId,
      sessionId,
      purpose: 'brief',
      messages,
      schema: BriefOutput,
      plan: effectivePlan(profile),
      preference,
      promptVersion: this.promptVersion,
    });

    // --- 4. apply_brief -----------------------------------------------------
    const facts: BriefFactInput[] = result.data.facts.map((fact) => ({
      text: fact.text,
      happens_on: fact.happens_on,
    }));

    const applied = await this.repository.applyBrief({
      p_session_id: sessionId,
      p_brief: result.data.brief,
      p_level_hint: result.data.level_hint,
      p_recurring_errors: result.data.recurring_errors,
      p_facts: facts,
    });

    if (!applied.applied) {
      // Otra ejecución del job ganó la carrera y ya dejó la sesión en `done`.
      return { status: 'skipped', reason: 'not_applied' };
    }

    // --- 5. Regla de nivel --------------------------------------------------
    const suggestedLevel = await this.maybeSuggestLevel(
      userId,
      result.data.level_hint,
      profile.level,
      profile.suggested_level,
    );

    return {
      status: 'applied',
      factsInserted: applied.facts_inserted,
      factsSkipped: applied.facts_skipped,
      provider: result.provider,
      modelUsed: result.modelUsed,
      degraded: result.degraded,
      suggestedLevel,
    };
  }

  /**
   * SPEC-05 §2, párrafo final. `apply_brief` ya archivó el brief anterior, así
   * que las dos entradas más recientes del histórico son los dos briefs previos
   * a este. El nivel del perfil no se toca nunca.
   */
  private async maybeSuggestLevel(
    userId: string,
    appliedLevelHint: Level | null,
    profileLevel: Level,
    currentSuggestedLevel: Level | null,
  ): Promise<Level | null> {
    if (appliedLevelHint === null) return null;

    const previousLevelHints = await this.repository.recentHistoryLevelHints(
      userId,
      CONSECUTIVE_PREVIOUS_HINTS,
    );

    const level = levelToSuggest({
      appliedLevelHint,
      previousLevelHints,
      profileLevel,
      currentSuggestedLevel,
    });

    if (level === null) return null;

    await this.repository.updateSuggestedLevel(userId, level);
    return level;
  }
}
