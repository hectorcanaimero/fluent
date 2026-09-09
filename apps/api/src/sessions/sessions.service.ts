import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ApiException } from '../common/api-error.js';
import type { Env } from '../config/env.js';
import { CALLBACK_PROBABILITY } from '../config/product.js';
import { getRoleplay } from '../content/index.js';
import { CredentialsService } from '../credentials/credentials.service.js';
import type { Fact, NewsItem, Profile, SessionKind } from '../db/schema.js';
import { BossService } from '../game/boss.service.js';
import { isoDateString } from '../game/iso-week.js';
import { MAX_FACTS_IN_PROMPT } from '../llm/config.js';
import { LlmService, LlmUnavailableError } from '../llm/llm.service.js';
import type { ModelPreference } from '../llm/model-resolver.js';
import {
  buildTurnMessages,
  type CallbackFact,
  type NewsScenario,
  type RoleplayScenario,
} from '../llm/prompts/turn.js';
import { TurnOutput } from '../llm/schemas.js';
import type { CreateSessionDto } from './dto/create-session.dto.js';
import { openingFor } from './session-openings.js';
import { NEWS_MAX_AGE_DAYS, SESSION_RANDOM, type SessionRandom } from './sessions.constants.js';
import { toSessionInfoDto } from './sessions.mapper.js';
import { SessionsRepository } from './sessions.repository.js';
import type { CreateSessionResultDto } from './sessions.types.js';
import { resolveFreeTopicPrompt } from './topic-prompt.js';

const NOT_ONBOARDED_MESSAGE =
  'Completa tu perfil antes de empezar una sesión de conversación.';
const SESSION_ALREADY_ACTIVE_MESSAGE =
  'Ya tienes una sesión abierta. Retómala o ciérrala antes de empezar otra.';
const PROVIDER_NOT_CONNECTED_MESSAGE =
  'Conecta un proveedor de IA antes de empezar una sesión.';
const VALIDATION_MESSAGE = 'Los datos enviados no son válidos.';
const NO_BOSS_TOPIC_MESSAGE =
  'No quedan temas de reto disponibles para tu nivel; elige otro tipo de sesión.';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Lo que se resuelve del `kind` antes de tocar la base (SPEC-04 §3.2). */
interface ResolvedScenario {
  /** Etiqueta legible que se guarda en `sessions.topic`. */
  readonly topic: string;
  /** Bloque de tema en inglés para el prompt (`free_topic` y `boss`). */
  readonly promptTopic?: string;
  readonly roleplay?: RoleplayScenario;
  readonly news?: NewsScenario;
  readonly newsItemId?: string;
}

/**
 * `POST /sessions` — apertura de sesión (SPEC-04 §3, RF-3.x y RF-4.4).
 *
 * **Idioma de los mensajes de error:** español fijo, sin cargar
 * `profiles.locale` solo para traducir, igual que `ProvidersService` y
 * `MemoryService` (PEND-29/PEND-43 de docs/specs/pendientes/PR-02.md). Aquí sí
 * se carga el perfil (hace falta el `level` y el `locale` para el prompt), pero
 * los mensajes siguen el criterio común del repo.
 *
 * Todas las decisiones que la spec no fija (orden de las escrituras, qué pasa
 * con el callback en una apertura degradada, qué hechos entran en el prompt,
 * cuándo se registra el rechazo del boss) están documentadas en
 * `docs/specs/pendientes/PR-04.md`.
 */
@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    private readonly repository: SessionsRepository,
    private readonly credentials: CredentialsService,
    private readonly llm: LlmService,
    private readonly boss: BossService,
    private readonly configService: ConfigService<Env, true>,
    @Inject(SESSION_RANDOM) private readonly random: SessionRandom,
  ) {}

  async openSession(userId: string, dto: CreateSessionDto): Promise<CreateSessionResultDto> {
    // 1. Perfil onboarded (SPEC-04 §3.1).
    const profile = await this.repository.findProfile(userId);
    if (profile === null || profile.onboarded_at === null) {
      throw ApiException.of('NOT_ONBOARDED', NOT_ONBOARDED_MESSAGE);
    }

    // 2. Una sola sesión activa por usuario (SPEC-04 §2).
    const activeSessionId = await this.repository.findActiveSessionId(userId);
    if (activeSessionId !== null) {
      throw ApiException.of('SESSION_ALREADY_ACTIVE', SESSION_ALREADY_ACTIVE_MESSAGE, {
        extra: { activeSessionId },
      });
    }

    // 3. Credencial activa de algún proveedor (SPEC-04 §3.1, SPEC-03 §2).
    const credentials = await this.credentials.listActive(userId);
    if (credentials.length === 0) {
      throw ApiException.of('PROVIDER_NOT_CONNECTED', PROVIDER_NOT_CONNECTED_MESSAGE);
    }

    // 4. Validación por `kind` (SPEC-04 §3.2).
    const scenario = await this.resolveScenario(userId, dto, profile);

    // 4.b El boss se ofrece, no se impone: si tocaba boss y el cliente pidió
    // otra cosa, se registra el rechazo de hoy (SPEC-04 §3.2, SPEC-07 §4).
    await this.recordBossSkipIfDeclined(userId, dto.kind, profile);

    // 5. Callback (RF-4.4, SPEC-04 §3.3). Se elige **antes** de la llamada al
    // LLM porque el hecho va dentro del prompt (`opening_rule` de SPEC-03
    // §4.1); no hay forma de decidirlo después.
    const callbackFact = await this.pickCallbackFact(userId);

    // 6. Prompt (SPEC-03 §4.1 con `opening_rule`).
    const [brief, facts] = await Promise.all([
      this.repository.findBriefText(userId),
      this.repository.listConfirmedFacts(userId, MAX_FACTS_IN_PROMPT),
    ]);

    const messages = buildTurnMessages({
      locale: profile.locale,
      level: profile.level,
      kind: dto.kind,
      topic: scenario.promptTopic,
      roleplay: scenario.roleplay,
      news: scenario.news,
      brief,
      facts: facts.map((fact) => fact.text),
      isFirstTurn: true,
      callbackFact: toCallbackFact(callbackFact),
    });

    // 7. Persistencia. La fila de `sessions` se crea **antes** de llamar al
    // LLM para poder pasarle su `id` como `sessionId` a `llm_calls` (SPEC-01
    // §2.14: la fila de auditoría referencia la sesión). Lo que solo se sabe
    // después (`chat_model_used`, `callback_fact_id`) se escribe en un UPDATE
    // posterior. Ver docs/specs/pendientes/PR-04.md.
    const session = await this.repository.createSession({
      userId,
      kind: dto.kind,
      topic: scenario.topic,
      newsItemId: scenario.newsItemId,
      challengeFromUserId: dto.challengeFromUserId ?? null,
    });

    const preference = await this.findPreference(userId);

    let opening: OpeningOutcome;
    let callbackUsed = false;

    try {
      const result = await this.llm.complete({
        userId,
        sessionId: session.id,
        purpose: 'turn',
        messages,
        schema: TurnOutput,
        credentials,
        preference,
        promptVersion: String(this.configService.get('PROMPT_VERSION', { infer: true })),
      });

      // Las correcciones de la apertura se ignoran: el aprendiz todavía no
      // habló, así que no hay nada suyo que corregir (ver pendientes).
      opening = {
        text: result.data.reply,
        model: result.modelUsed,
        tokensIn: result.usage.tokensIn,
        tokensOut: result.usage.tokensOut,
        // `LlmServiceResult` no expone la latencia suelta: la del intento que
        // salió bien es la del último elemento de `attempts` (SPEC-03 §2).
        latencyMs: roundLatency(result.attempts.at(-1)?.latencyMs ?? null),
      };
      callbackUsed = callbackFact !== null;
    } catch (error) {
      if (!(error instanceof LlmUnavailableError)) {
        // Fallo inesperado (no "cadena agotada"): no dejamos una sesión
        // `active` fantasma que bloquee al usuario con SESSION_ALREADY_ACTIVE.
        await this.repository.deleteSession(userId, session.id);
        throw error;
      }

      // 8. Apertura degradada (SPEC-04 §3, SPEC-03 §6): saludo fijo por
      // `kind`, la sesión sigue `active`, el turno se guarda sin modelo ni
      // métricas, y `callbackUsed` es `false` porque el hecho no llegó a
      // usarse en el texto que ve el aprendiz.
      this.logger.warn(
        `Apertura degradada de la sesión ${session.id}: se agotó la cadena de modelos.`,
      );
      opening = {
        text: openingFor(dto.kind),
        model: null,
        tokensIn: null,
        tokensOut: null,
        latencyMs: null,
      };
    }

    const updated = await this.repository.updateAfterOpening(userId, session.id, {
      chatModelUsed: opening.model,
      callbackFactId: callbackUsed ? (callbackFact?.id ?? null) : null,
    });

    await this.repository.insertOpeningTurn({
      sessionId: session.id,
      text: opening.text,
      model: opening.model,
      tokensIn: opening.tokensIn,
      tokensOut: opening.tokensOut,
      latencyMs: opening.latencyMs,
    });

    return {
      session: toSessionInfoDto(updated ?? session),
      opening: { text: opening.text, callbackUsed },
    };
  }

  /** Preferencia del rol `chat`; `null` si el usuario no eligió modelo. */
  private async findPreference(userId: string): Promise<ModelPreference | null> {
    const preference = await this.repository.findChatModelPreference(userId);
    return preference === null
      ? null
      : { provider: preference.provider, model: preference.model };
  }

  /**
   * SPEC-04 §3.3: con probabilidad `CALLBACK_PROBABILITY` **y** si la sesión
   * anterior no usó callback. Sin sesiones previas cuenta como "no usó".
   */
  private async pickCallbackFact(userId: string): Promise<Fact | null> {
    if (this.random() >= CALLBACK_PROBABILITY) {
      return null;
    }

    const last = await this.repository.findLastSessionCallback(userId);
    if (last.found && last.callbackFactId !== null) {
      return null;
    }

    return this.repository.pickCallbackFact(userId);
  }

  /**
   * SPEC-04 §3.2 y SPEC-07 §4: si a esta sesión le tocaba boss
   * (`BossService.isPending`) y el cliente pidió otro `kind`, se registra el
   * rechazo del día. Solo se llama con la validación del `kind` ya superada,
   * para no anotar un rechazo por una petición que va a fallar con `400`.
   */
  private async recordBossSkipIfDeclined(
    userId: string,
    kind: SessionKind,
    profile: Profile,
  ): Promise<void> {
    if (kind === 'boss') {
      return;
    }

    const pending = await this.boss.isPending(userId, {
      sessionsCount: profile.sessions_count,
      level: profile.level,
    });

    if (pending) {
      await this.boss.recordSkip(userId);
    }
  }

  /** Validación y resolución del escenario por `kind` (SPEC-04 §3.2). */
  private async resolveScenario(
    userId: string,
    dto: CreateSessionDto,
    profile: Profile,
  ): Promise<ResolvedScenario> {
    switch (dto.kind) {
      case 'free_topic':
        return this.resolveFreeTopic(dto.topic);
      case 'roleplay':
        return this.resolveRoleplay(dto.roleplayId);
      case 'news':
        return this.resolveNews(dto.newsItemId);
      case 'boss':
        return this.resolveBoss(userId, profile);
    }
  }

  private resolveFreeTopic(topic: string | undefined): ResolvedScenario {
    const trimmed = topic?.trim() ?? '';
    if (trimmed === '') {
      throw validationError('topic', 'topic es obligatorio para kind=free_topic.');
    }
    return { topic: trimmed, promptTopic: resolveFreeTopicPrompt(trimmed) };
  }

  private resolveRoleplay(roleplayId: string | undefined): ResolvedScenario {
    if (!roleplayId) {
      throw validationError('roleplayId', 'roleplayId es obligatorio para kind=roleplay.');
    }
    const roleplay = getRoleplay(roleplayId);
    if (!roleplay) {
      throw validationError('roleplayId', 'roleplayId no existe en el catálogo de escenarios.');
    }
    return {
      topic: roleplay.title_es,
      roleplay: { role: roleplay.role, situation: roleplay.situation },
    };
  }

  private async resolveNews(newsItemId: string | undefined): Promise<ResolvedScenario> {
    if (!newsItemId) {
      throw validationError('newsItemId', 'newsItemId es obligatorio para kind=news.');
    }

    const item = await this.repository.findNewsItem(newsItemId);
    if (item === null) {
      throw validationError('newsItemId', 'La noticia indicada no existe.');
    }
    if (!isWithinNewsWindow(item)) {
      throw validationError(
        'newsItemId',
        `La noticia es de hace más de ${NEWS_MAX_AGE_DAYS} días.`,
      );
    }

    return {
      topic: item.title,
      news: { title: item.title, summary: item.summary ?? '' },
      newsItemId: item.id,
    };
  }

  private async resolveBoss(userId: string, profile: Profile): Promise<ResolvedScenario> {
    const topic = await this.boss.pickTopic(userId, profile.level);
    if (topic === null) {
      // docs/specs/pendientes/PR-07.md T3 §4 deja esta decisión a la capa de
      // API: `pickTopic === null` no es un error interno, es "no hay boss
      // disponible", y el cliente debe elegir otro `kind`.
      throw ApiException.of('VALIDATION', NO_BOSS_TOPIC_MESSAGE, {
        extra: { details: [{ field: 'kind', reason: NO_BOSS_TOPIC_MESSAGE }] },
      });
    }
    return { topic: topic.title_es, promptTopic: topic.prompt_en };
  }
}

/** Lo que se persiste en `turns[0]`, venga del modelo o del saludo fijo. */
interface OpeningOutcome {
  readonly text: string;
  readonly model: string | null;
  readonly tokensIn: number | null;
  readonly tokensOut: number | null;
  readonly latencyMs: number | null;
}

/** `turns.latency_ms` es `int`: se redondea y nunca es negativo. */
function roundLatency(latencyMs: number | null): number | null {
  return latencyMs === null ? null : Math.max(0, Math.round(latencyMs));
}

/** `400 VALIDATION` con `details[]`, tal y como lo formatea PR-02/T3. */
function validationError(field: string, reason: string): ApiException {
  return ApiException.of('VALIDATION', VALIDATION_MESSAGE, {
    extra: { details: [{ field, reason }] },
  });
}

/** `news_items.day` (fecha ISO) dentro de los últimos `NEWS_MAX_AGE_DAYS` días. */
export function isWithinNewsWindow(item: Pick<NewsItem, 'day'>, now: Date = new Date()): boolean {
  const cutoff = isoDateString(new Date(now.getTime() - NEWS_MAX_AGE_DAYS * DAY_MS));
  // Las fechas ISO `YYYY-MM-DD` se ordenan igual como texto que como fechas.
  return item.day >= cutoff;
}

/** Fila de `facts` → `CallbackFact` del prompt de turno (SPEC-03 §4.1). */
function toCallbackFact(fact: Fact | null): CallbackFact | null {
  return fact === null ? null : { text: fact.text, happensOn: fact.happens_on };
}
