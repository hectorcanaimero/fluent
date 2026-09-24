import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ApiException } from '../common/api-error.js';
import type { Env } from '../config/env.js';
import { CALLBACK_PROBABILITY } from '../config/product.js';
import { getRoleplay } from '../content/index.js';
import type { Fact, NewsItem, Profile, Session, SessionKind } from '../db/schema.js';
import { BossService } from '../game/boss.service.js';
import { isoDateString } from '../game/iso-week.js';
import { MAX_FACTS_IN_PROMPT } from '../llm/config.js';
import type { Provider as LlmProvider } from '../llm/config.js';
import { LlmService, LlmUnavailableError } from '../llm/llm.service.js';
import type { ModelPreference } from '../llm/model-resolver.js';
import { effectivePlan } from '../profiles/plan.js';
import { buildTurnMessages, type CallbackFact } from '../llm/prompts/turn.js';
import { TurnOutput } from '../llm/schemas.js';
import type { CreateSessionDto } from './dto/create-session.dto.js';
import {
  bossScenario,
  freeTopicScenario,
  newsScenario,
  roleplayScenario,
  type SessionScenario,
} from './scenario.js';
import { openingFor } from './session-openings.js';
import { NEWS_MAX_AGE_DAYS, SESSION_RANDOM, type SessionRandom } from './sessions.constants.js';
import { roundLatency, toSessionInfoDto } from './sessions.mapper.js';
import { JOB_DISPATCHER, type JobDispatcher } from '../jobs/job-dispatcher.js';
import { ChallengesService } from '../social/challenges.service.js';
import type { ChallengesResultDto } from '../social/social.types.js';
import { SessionsRepository } from './sessions.repository.js';
import type { CreateSessionResultDto } from './sessions.types.js';

const NOT_ONBOARDED_MESSAGE =
  'Completa tu perfil antes de empezar una sesión de conversación.';
/**
 * MEJ-33: practicar exige pertenecer a un grupo. El texto es el mismo de
 * `i18n/es.json`, repetido aquí porque este servicio no traduce (ver el
 * comentario de la clase).
 */
const GROUP_REQUIRED_MESSAGE =
  'Unite a un grupo con tu código de invitación para practicar.';
const SESSION_ALREADY_ACTIVE_MESSAGE =
  'Ya tienes una sesión abierta. Retómala o ciérrala antes de empezar otra.';
const VALIDATION_MESSAGE = 'Los datos enviados no son válidos.';
const NO_BOSS_TOPIC_MESSAGE =
  'No quedan temas de reto disponibles para tu nivel; elige otro tipo de sesión.';
const CHALLENGE_NOT_AVAILABLE_MESSAGE =
  'Ese desafío ya no está disponible; elige otro o empieza una sesión normal.';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Antigüedad máxima de una sesión para reintentar su brief fallido (MAL-20).
 * Pasados unos días sus notas ya no valen gran cosa y reintentarlas solo
 * gasta tokens del aprendiz.
 */
const FAILED_BRIEF_MAX_AGE_DAYS = 3;

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
    private readonly llm: LlmService,
    private readonly boss: BossService,
    private readonly challenges: ChallengesService,
    @Inject(JOB_DISPATCHER) private readonly jobs: JobDispatcher,
    private readonly configService: ConfigService<Env, true>,
    @Inject(SESSION_RANDOM) private readonly random: SessionRandom,
  ) {}

  async openSession(userId: string, dto: CreateSessionDto): Promise<CreateSessionResultDto> {
    // 1. Perfil onboarded (SPEC-04 §3.1).
    const profile = await this.repository.findProfile(userId);
    if (profile === null || profile.onboarded_at === null) {
      throw ApiException.of('NOT_ONBOARDED', NOT_ONBOARDED_MESSAGE);
    }

    // 1.b Grupo obligatorio para practicar (MEJ-33, SPEC-02 §4.2). Va antes
    // que todo lo demás.
    if (profile.group_id === null) {
      throw ApiException.of('GROUP_REQUIRED', GROUP_REQUIRED_MESSAGE);
    }

    // 2. Una sola sesión activa por usuario (SPEC-04 §2).
    const activeSessionId = await this.repository.findActiveSessionId(userId);
    if (activeSessionId !== null) {
      throw ApiException.of('SESSION_ALREADY_ACTIVE', SESSION_ALREADY_ACTIVE_MESSAGE, {
        extra: { activeSessionId },
      });
    }

    // 3. Validación por `kind` (SPEC-04 §3.2).
    const scenario = await this.resolveScenario(userId, dto, profile);

    // 4.b El desafío se valida contra la lista real del usuario (SPEC-07 §7).
    // Va **antes** del rechazo de boss: si esto falla con 422, la petición no
    // debe haber quemado la oferta de boss del día.
    await this.requireOfferedChallenge(userId, dto, scenario);

    // 4.c El boss se ofrece, no se impone: si tocaba boss y el cliente pidió
    // otra cosa, se registra el rechazo de hoy (SPEC-04 §3.2, SPEC-07 §4).
    await this.recordBossSkipIfDeclined(userId, dto.kind, profile);

    // 4.d Recuperación del brief fallido (MAL-20). Se hace al abrir la sesión
    // siguiente porque es el momento en que el brief vuelve a hacer falta, y
    // sin bloquear: si el reencolado falla, la sesión se abre igual.
    void this.retryFailedBrief(userId);

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
    const session: Session = await this.repository.createSession({
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
        plan: effectivePlan(profile),
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
      : { provider: preference.provider as LlmProvider, model: preference.model };
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

  /**
   * Reencola el `coaching-brief` de la última sesión cuyo job agotó los
   * reintentos, si es reciente (MAL-20).
   *
   * Sin esto, un brief que fallaba se quedaba marcado y nadie volvía a
   * intentarlo: las sesiones siguientes arrancaban sin notas de coaching y en
   * silencio, que es el peor tipo de degradación —el aprendiz no nota nada,
   * simplemente el tutor deja de acordarse de él.
   *
   * Es idempotente por `jobId = sessionId` (`BullJobDispatcher`), así que dos
   * aperturas seguidas no duplican el job. Nunca lanza: abrir una sesión no
   * puede fallar porque la cola esté caída.
   */
  private async retryFailedBrief(userId: string): Promise<void> {
    try {
      const sessionId = await this.repository.findRecentFailedBriefSessionId(
        userId,
        FAILED_BRIEF_MAX_AGE_DAYS,
      );
      if (sessionId === null) return;

      await this.jobs.enqueueCoachingBrief(sessionId);
      this.logger.log(
        `Brief fallido de la sesión ${sessionId} reencolado al abrir una sesión nueva`,
      );
    } catch (error) {
      this.logger.warn(
        `No se pudo reencolar el brief fallido de ${userId}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * SPEC-07 §7: `challengeFromUserId` solo vale si ese usuario aparece **hoy**
   * en los desafíos que `GET /challenges` le ofrece a quien abre la sesión,
   * con el mismo tema.
   *
   * Sin esta comprobación el campo era auto-otorgable: bastaba con mandar el
   * `id` de cualquier compañero de grupo para marcar la sesión como desafío y
   * cobrar su bono de XP al cerrarla (MAL-19 del peine fino).
   *
   * La comparación es contra `scenario.topic` —la etiqueta que se guarda en
   * `sessions.topic`— y no contra `dto.topic`: es el mismo valor que
   * `ChallengesService` devuelve como `topic` del candidato, y para `roleplay`
   * y `news` el cliente manda `roleplayId`/`newsItemId` en vez del texto.
   *
   * **No** se exige que el `kind` coincida.  `GET /challenges` ofrece desafíos
   * de los cuatro `kind`, pero no expone el `roleplayId` ni el `newsItemId`
   * del original, así que la app los reabre todos como `free_topic` con el
   * tema legible (ver `group_screen.dart._acceptChallenge`). Exigir el `kind`
   * dejaba sin aceptar todo desafío que no fuera `free_topic`, y para `boss`
   * era imposible por construcción: `resolveBoss` ignora el tema que mande el
   * cliente y elige el siguiente del propio solicitante.
   *
   * Un usuario sin grupo no tiene desafíos posibles: `listChallenges` responde
   * `NOT_ONBOARDED` y aquí se traduce al mismo 422 que cualquier otro desafío
   * inexistente, para no filtrar por qué falló.
   */
  private async requireOfferedChallenge(
    userId: string,
    dto: CreateSessionDto,
    scenario: SessionScenario,
  ): Promise<void> {
    // `== null` y no `=== undefined`: `@IsOptional()` deja pasar un `null`
    // explícito, y `createSession` más abajo ya lo trata como "sin desafío"
    // (`dto.challengeFromUserId ?? null`).
    if (dto.challengeFromUserId == null) {
      return;
    }

    let offered: ChallengesResultDto;
    try {
      offered = await this.challenges.listChallenges(userId);
    } catch (error) {
      if (error instanceof ApiException && error.code === 'NOT_ONBOARDED') {
        throw ApiException.of('CHALLENGE_NOT_AVAILABLE', CHALLENGE_NOT_AVAILABLE_MESSAGE);
      }
      throw error;
    }

    const match = offered.items.some(
      (item) =>
        item.fromUserId === dto.challengeFromUserId && item.topic === scenario.topic,
    );

    if (!match) {
      throw ApiException.of('CHALLENGE_NOT_AVAILABLE', CHALLENGE_NOT_AVAILABLE_MESSAGE);
    }
  }

  /** Validación y resolución del escenario por `kind` (SPEC-04 §3.2). */
  private async resolveScenario(
    userId: string,
    dto: CreateSessionDto,
    profile: Profile,
  ): Promise<SessionScenario> {
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

  private resolveFreeTopic(topic: string | undefined): SessionScenario {
    const trimmed = topic?.trim() ?? '';
    if (trimmed === '') {
      throw validationError('topic', 'topic es obligatorio para kind=free_topic.');
    }
    return freeTopicScenario(trimmed);
  }

  private resolveRoleplay(roleplayId: string | undefined): SessionScenario {
    if (!roleplayId) {
      throw validationError('roleplayId', 'roleplayId es obligatorio para kind=roleplay.');
    }
    const roleplay = getRoleplay(roleplayId);
    if (!roleplay) {
      throw validationError('roleplayId', 'roleplayId no existe en el catálogo de escenarios.');
    }
    return roleplayScenario(roleplay);
  }

  private async resolveNews(newsItemId: string | undefined): Promise<SessionScenario> {
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

    return newsScenario(item);
  }

  private async resolveBoss(userId: string, profile: Profile): Promise<SessionScenario> {
    const topic = await this.boss.pickTopic(userId, profile.level);
    if (topic === null) {
      // docs/specs/pendientes/PR-07.md T3 §4 deja esta decisión a la capa de
      // API: `pickTopic === null` no es un error interno, es "no hay boss
      // disponible", y el cliente debe elegir otro `kind`.
      throw ApiException.of('VALIDATION', NO_BOSS_TOPIC_MESSAGE, {
        extra: { details: [{ field: 'kind', reason: NO_BOSS_TOPIC_MESSAGE }] },
      });
    }
    return bossScenario(topic);
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
