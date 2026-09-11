import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ApiException } from '../common/api-error.js';
import type { Env } from '../config/env.js';
import { CredentialsService } from '../credentials/credentials.service.js';
import type { Profile, Session } from '../db/schema.js';
import {
  DEGRADED_REPLY,
  HISTORY_TURNS,
  MAX_FACTS_IN_PROMPT,
  TURN_MAX_ATTEMPTS,
} from '../llm/config.js';
import { LlmService, LlmUnavailableError } from '../llm/llm.service.js';
import type { ActiveCredential, ModelPreference } from '../llm/model-resolver.js';
import type { HistoryTurn } from '../llm/prompts/truncate.js';
import { buildTurnMessages } from '../llm/prompts/turn.js';
import { TurnOutput, type Correction as CorrectionOutput } from '../llm/schemas.js';
import { RedisService } from '../redis/redis.service.js';
import type { CreateTurnDto } from './dto/create-turn.dto.js';
import { rebuildScenario } from './scenario.js';
import { findOwnedSessionOrThrow } from './session-ownership.js';
import {
  REDIS_FLAG_VALUE,
  TURN_LOCK_TTL_SECONDS,
  TURN_PACE_TTL_SECONDS,
  turnLockKey,
  turnPaceKey,
} from './sessions.constants.js';
import { roundLatency, toCorrectionDto } from './sessions.mapper.js';
import { secondsUntilUserMidnight, turnsDayKey, userDay } from './user-day.js';
import { SessionsRepository } from './sessions.repository.js';
import type { CorrectionDto, TurnResultDto } from './sessions.types.js';
import { TurnsRepository, type InsertCorrectionRow } from './turns.repository.js';

const SESSION_NOT_ACTIVE_MESSAGE = 'Esta sesión ya no está activa.';
const TURN_IN_PROGRESS_MESSAGE = 'Espera la respuesta anterior antes de enviar otro turno.';
const TURNS_DAILY_CAP_MESSAGE =
  'Por hoy alcanzaste el máximo de turnos. Mañana seguimos.';
const TOO_FAST_MESSAGE = 'Vas demasiado rápido: espera un momento antes del siguiente turno.';
const VALIDATION_MESSAGE = 'Los datos enviados no son válidos.';
const NOT_ONBOARDED_MESSAGE = 'Completa tu perfil antes de seguir la conversación.';
const PROVIDER_NOT_CONNECTED_MESSAGE = 'Conecta un proveedor de IA para seguir la conversación.';

/**
 * `corrections.note` tiene un CHECK de 140 caracteres (migración 3). El
 * esquema zod `Correction` ya lo limita, pero el modelo escribe ese texto y no
 * se confía en que el `.max(140)` haya recortado en vez de rechazar: se vuelve
 * a recortar aquí antes del INSERT.
 */
const CORRECTION_NOTE_MAX_CHARS = 140;

/** Lo que se persiste en el turno del tutor, venga del modelo o de la degradación. */
interface TutorOutcome {
  readonly text: string;
  readonly corrections: readonly CorrectionOutput[];
  readonly model: string | null;
  readonly tokensIn: number | null;
  readonly tokensOut: number | null;
  readonly latencyMs: number | null;
  readonly degraded: boolean;
}

/**
 * `POST /sessions/:id/turns` — turno de conversación (SPEC-04 §4, RF-3.2 a
 * RF-3.5).
 *
 * Orden exacto: validación de propiedad y estado → lock de concurrencia →
 * ritmo → turno del usuario → historial → modelo → turno del tutor,
 * correcciones y contadores.
 *
 * **`POST /sessions/:id/turns/stream` (T4) usa este mismo servicio**: la
 * única diferencia con el endpoint no streaming es el `onToken` opcional de
 * `addTurn`, que se pasa hasta `LlmService.complete` para pedir `stream: true`
 * al proveedor, y la forma de escribir la respuesta HTTP (eso vive en
 * `turn-stream.ts`, no aquí). Todo lo demás —validación, lock, ritmo,
 * historial, prompt, persistencia, correcciones, contadores y degradación—
 * es literalmente el mismo código.
 *
 * **Por qué el lock va antes que el ritmo** (decisión documentada en
 * docs/specs/pendientes/PR-04.md): dos turnos verdaderamente simultáneos
 * tienen que distinguirse de un cliente que va demasiado rápido. Si la
 * ventana de 2 s se reclamara primero, uno de los dos turnos simultáneos
 * saldría con `429 RATE_LIMITED` en vez del `409 SESSION_NOT_ACTIVE` que pide
 * SPEC-04 §4.
 *
 * **Idioma de los mensajes de error:** español fijo, igual que
 * `SessionsService` y `MemoryService` (PEND-29/PEND-43 de PR-02).
 */
@Injectable()
export class TurnsService {
  private readonly logger = new Logger(TurnsService.name);

  constructor(
    private readonly sessions: SessionsRepository,
    private readonly turns: TurnsRepository,
    private readonly credentials: CredentialsService,
    private readonly llm: LlmService,
    private readonly redis: RedisService,
    private readonly configService: ConfigService<Env, true>,
  ) {}

  async addTurn(
    userId: string,
    sessionId: string,
    dto: CreateTurnDto,
    onToken?: (delta: string) => void,
    onReset?: () => void,
  ): Promise<TurnResultDto> {
    const text = dto.text.trim();
    if (text === '') {
      // `@Length(1, 1000)` acepta un texto de solo espacios; el prompt no.
      throw ApiException.of('VALIDATION', VALIDATION_MESSAGE, {
        extra: { details: [{ field: 'text', reason: 'text no puede estar en blanco.' }] },
      });
    }

    // 1. Propiedad y estado de la sesión (SPEC-04 §4 paso 1).
    const session = await this.findActiveOwnedSession(userId, sessionId);

    // 2. Lock de concurrencia (SPEC-04 §4). Con Redis caído `setIfAbsent`
    // devuelve `true` (fail-open, ver `RedisService`): se pierde la
    // protección, no el servicio.
    const lockKey = turnLockKey(session.id);
    const locked = await this.redis.setIfAbsent(
      lockKey,
      REDIS_FLAG_VALUE,
      TURN_LOCK_TTL_SECONDS,
    );
    if (!locked) {
      throw ApiException.of('SESSION_NOT_ACTIVE', TURN_IN_PROGRESS_MESSAGE);
    }

    try {
      // 3. Ritmo: un turno cada 2 s por sesión (SPEC-02 §7).
      const paceKey = turnPaceKey(session.id);
      const paced = await this.redis.setIfAbsent(
        paceKey,
        REDIS_FLAG_VALUE,
        TURN_PACE_TTL_SECONDS,
      );
      if (!paced) {
        throw ApiException.of('RATE_LIMITED', TOO_FAST_MESSAGE);
      }

      const result = await this.runTurn(userId, session, text, onToken, onReset);

      // La ventana se reinicia al **terminar** el turno: así los 2 s se
      // cuentan desde que el aprendiz tuvo la respuesta delante, no desde que
      // empezó a esperarla (una llamada al modelo suele durar más de 2 s, y
      // si no se refrescara la clave el límite no llegaría a aplicarse nunca).
      await this.redis.set(paceKey, REDIS_FLAG_VALUE, TURN_PACE_TTL_SECONDS);

      return result;
    } finally {
      await this.redis.del(lockKey);
    }
  }

  /**
   * Credenciales de una sesión de cortesía (MAL-24): las del owner del grupo.
   *
   * Si el aprendiz conectó su propia key a mitad de sesión, se usa la suya:
   * es mejor gastar la del dueño de la cuenta que la prestada, y evita que
   * una sesión larga siga consumiendo del owner más de lo necesario.
   */
  private async courtesyCredentials(
    profile: Profile,
    own: readonly ActiveCredential[],
  ): Promise<readonly ActiveCredential[]> {
    if (own.length > 0 || profile.group_id === null) {
      return own;
    }

    const ownerId = await this.sessions.findGroupOwnerId(profile.group_id);
    if (ownerId === null || ownerId === profile.user_id) {
      return own;
    }

    return this.credentials.listActive(ownerId);
  }

  /**
   * Cuenta el turno del día y rechaza con `429 TURNS_DAILY_CAP` al pasarse
   * (MAL-23).
   *
   * El día es el **natural del aprendiz** (`profiles.timezone`), no UTC: a
   * alguien en Buenos Aires no se le puede reiniciar el cupo a las 21:00 de
   * su tarde. `Retry-After` lleva los segundos que faltan para su medianoche,
   * que es cuando el contador caduca de verdad.
   *
   * Con `TURNS_DAILY_CAP=0` el tope queda desactivado. Con Redis caído
   * `increment` devuelve `null` y se deja pasar (fail-open), igual que el
   * lock de turno: bloquear a todo el mundo durante una caída de Redis es
   * peor que perder temporalmente el tope.
   */
  private async requireDailyTurnsBudget(userId: string, profile: Profile): Promise<void> {
    const cap = this.configService.get('TURNS_DAILY_CAP', { infer: true });
    if (cap <= 0) {
      return;
    }

    const now = new Date();
    const retryAfter = secondsUntilUserMidnight(profile.timezone, now);
    const key = turnsDayKey(userId, userDay(profile.timezone, now));

    const used = await this.redis.increment(key, retryAfter);
    if (used === null || used <= cap) {
      return;
    }

    throw ApiException.of('TURNS_DAILY_CAP', TURNS_DAILY_CAP_MESSAGE, {
      extra: { retryAfter },
    });
  }

  /**
   * `403 FORBIDDEN` si la sesión no existe o es de otro usuario, o si el
   * `:id` ni siquiera tiene forma de UUID (`findOwnedSessionOrThrow`,
   * compartida con T3 — PEND-42 de PR-02 y ver docs/specs/pendientes/PR-04.md).
   * `409 SESSION_NOT_ACTIVE` si ya está `ended` o `abandoned` (SPEC-02 §6):
   * esa comprobación es propia del turno, no la reutiliza `POST .../end`.
   */
  private async findActiveOwnedSession(userId: string, sessionId: string): Promise<Session> {
    const session = await findOwnedSessionOrThrow(this.turns, userId, sessionId);
    if (session.status !== 'active') {
      throw ApiException.of('SESSION_NOT_ACTIVE', SESSION_NOT_ACTIVE_MESSAGE);
    }
    return session;
  }

  /** Pasos 2 a 7 de SPEC-04 §4, ya con el lock y el ritmo resueltos. */
  private async runTurn(
    userId: string,
    session: Session,
    text: string,
    onToken?: (delta: string) => void,
    onReset?: () => void,
  ): Promise<TurnResultDto> {
    // Contexto del turno en paralelo (MEJ-24). Eran tres viajes a InsForge en
    // fila —perfil, credenciales, historial— sin ninguna dependencia entre
    // ellos, y el aprendiz esperaba la suma de las tres latencias antes de
    // que siquiera empezara la llamada al modelo.
    //
    // El **orden de validación** se conserva tal cual (perfil → tope →
    // credenciales): lo único que cambia es cuándo se lanzan las consultas,
    // no qué error gana ni qué se escribe. En particular el tope diario sigue
    // sin consumirse para un perfil sin onboarding.
    //
    // El historial se lee **antes** de insertar el turno del usuario, porque
    // ese va aparte como `userMessage` y no dentro de `history`: por eso la
    // inserción sigue siendo secuencial y posterior.
    const [profile, ownCredentials, history] = await Promise.all([
      this.sessions.findProfile(userId),
      this.credentials.listActive(userId),
      this.turns.listRecentTurns(session.id, HISTORY_TURNS),
    ]);

    if (profile === null || profile.onboarded_at === null) {
      throw ApiException.of('NOT_ONBOARDED', NOT_ONBOARDED_MESSAGE);
    }

    // 2.b Tope diario de turnos (MAL-23). Va **antes** de insertar el turno
    // del usuario y de llamar al modelo: pasado el tope no se escribe nada ni
    // se gasta un céntimo de la key del aprendiz.
    await this.requireDailyTurnsBudget(userId, profile);

    // En una sesión de cortesía la key es la del owner del grupo (MAL-24), y
    // eso vale para **todos** los turnos, no solo para la apertura: si aquí
    // se mirara solo `listActive(userId)`, el primer mensaje del aprendiz
    // fallaría con PROVIDER_NOT_CONNECTED y se habría quedado con el saludo
    // y nada más, con su única sesión gratuita ya gastada.
    const credentials = session.courtesy
      ? await this.courtesyCredentials(profile, ownCredentials)
      : ownCredentials;

    if (credentials.length === 0) {
      // El usuario borró la credencial con la sesión abierta: sin ninguna
      // key no hay cadena de fallback que agotar, así que no es una
      // degradación (SPEC-03 §6) sino el mismo error que al abrir.
      throw ApiException.of('PROVIDER_NOT_CONNECTED', PROVIDER_NOT_CONNECTED_MESSAGE);
    }

    // La apertura del tutor es `idx = 0`; cada turno toma el último + 1. Con
    // la sesión sin ningún turno (imposible hoy: la apertura siempre inserta
    // el 0) el primer turno del usuario sería el 0.
    const lastIdx = history.at(-1)?.idx ?? -1;
    const userTurnIdx = lastIdx + 1;

    // 2. Turno del usuario (SPEC-04 §4 paso 2).
    await this.turns.insertTurn({
      sessionId: session.id,
      idx: userTurnIdx,
      role: 'user',
      text,
    });

    let outcome: TutorOutcome;
    try {
      outcome = await this.completeTurn(
        userId,
        session,
        profile,
        history,
        text,
        credentials,
        onToken,
        onReset,
      );
    } catch (error) {
      // Fallo inesperado (no "cadena agotada"): no dejamos un turno del
      // aprendiz sin respuesta en el transcript, que descuadraría el
      // historial y el resumen del brief. Mismo criterio que PEND-03 en la
      // apertura, donde un error inesperado borra la sesión recién creada.
      await this.rollbackUserTurn(session.id, userTurnIdx);
      throw error;
    }

    return this.persistTutorTurn(userId, session, userTurnIdx, outcome);
  }

  /**
   * Llamada al modelo (SPEC-04 §4 paso 4). Si se agota la cadena devuelve la
   * respuesta degradada de SPEC-03 §6 (RF-2.5) en vez de lanzar.
   */
  private async completeTurn(
    userId: string,
    session: Session,
    profile: Profile,
    history: readonly HistoryTurn[],
    text: string,
    credentials: readonly ActiveCredential[],
    onToken?: (delta: string) => void,
    onReset?: () => void,
  ): Promise<TutorOutcome> {
    // Escenario reconstruido desde la fila de `sessions` y el catálogo, para
    // que el tutor siga con el mismo rol/noticia/reto con el que abrió.
    // Lo que falta para el prompt, también en paralelo (MEJ-24): noticia,
    // brief, hechos y preferencia de modelo son cuatro lecturas
    // independientes entre sí.
    const [newsItem, brief, facts, preference] = await Promise.all([
      session.news_item_id === null
        ? Promise.resolve(null)
        : this.sessions.findNewsItem(session.news_item_id),
      this.sessions.findBriefText(userId),
      this.sessions.listConfirmedFacts(userId, MAX_FACTS_IN_PROMPT),
      // En cortesía no se aplica la preferencia: sin ella `ModelResolver`
      // solo ofrece la cadena gratuita, y la key es prestada (MAL-24).
      session.courtesy ? Promise.resolve(null) : this.findPreference(userId),
    ]);

    const scenario = rebuildScenario(session, newsItem);
    if (scenario.fallback) {
      this.logger.warn(
        `No se pudo reconstruir el escenario ${session.kind} de la sesión ${session.id}; ` +
          'se continúa con el bloque free_topic y el topic guardado.',
      );
    }

    const messages = buildTurnMessages({
      locale: profile.locale,
      level: profile.level,
      kind: scenario.kind,
      topic: scenario.promptTopic,
      roleplay: scenario.roleplay,
      news: scenario.news,
      brief,
      facts: facts.map((fact) => fact.text),
      history,
      userMessage: text,
      // El `callbackFact` y la `opening_rule` son exclusivos de la apertura
      // (SPEC-03 §4.1): a partir del segundo turno el hecho ya se mencionó.
      isFirstTurn: false,
    });

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
        // Dos intentos y no tres (MAL-23): el aprendiz está esperando delante
        // de la pantalla y 3 × 25 s son 75 s de silencio antes de rendirse.
        maxAttempts: TURN_MAX_ATTEMPTS,
        // Solo lo manda el endpoint SSE (T4): sin `onToken` la llamada es
        // exactamente la de siempre, sin `stream: true`.
        onToken,
        // Aviso de que la cadena de fallback cambió de modelo tras haber
        // emitido texto, para que la app vacíe la burbuja (MAL-22).
        onReset,
      });

      return {
        text: result.data.reply,
        corrections: result.data.corrections,
        model: result.modelUsed,
        tokensIn: result.usage.tokensIn,
        tokensOut: result.usage.tokensOut,
        // `LlmServiceResult` no expone la latencia suelta: la del intento que
        // salió bien es la del último de `attempts` (PEND-19).
        latencyMs: roundLatency(result.attempts.at(-1)?.latencyMs ?? null),
        degraded: false,
      };
    } catch (error) {
      if (!(error instanceof LlmUnavailableError)) {
        throw error;
      }

      this.logger.warn(
        `Turno degradado en la sesión ${session.id}: se agotó la cadena de modelos.`,
      );
      return {
        text: DEGRADED_REPLY,
        corrections: [],
        model: null,
        tokensIn: null,
        tokensOut: null,
        latencyMs: null,
        degraded: true,
      };
    }
  }

  /** Pasos 5, 6 y 7 de SPEC-04 §4. */
  private async persistTutorTurn(
    userId: string,
    session: Session,
    userTurnIdx: number,
    outcome: TutorOutcome,
  ): Promise<TurnResultDto> {
    const rows: InsertCorrectionRow[] = outcome.corrections.map((correction) => ({
      sessionId: session.id,
      userId,
      // `corrections.turn_idx` apunta siempre al turno **del usuario**
      // (decisión de la sesión líder): es el mensaje que se está corrigiendo.
      turnIdx: userTurnIdx,
      original: correction.original,
      corrected: correction.corrected,
      category: correction.category,
      note: clampNote(correction.note),
    }));

    // Una sola transacción para las tres escrituras (MEJ-25). `turns_count`
    // cuenta turnos **del usuario** (PEND-18), así que avanza también en la
    // respuesta degradada: el aprendiz sí habló.
    await this.turns.recordTurn({
      sessionId: session.id,
      tutorIdx: userTurnIdx + 1,
      text: outcome.text,
      model: outcome.model,
      tokensIn: outcome.tokensIn,
      tokensOut: outcome.tokensOut,
      latencyMs: outcome.latencyMs,
      turnsCount: session.turns_count + 1,
      corrections: rows,
    });

    const corrections: CorrectionDto[] = rows.map((row) => toCorrectionDto(row));

    return outcome.degraded
      ? {
          turnIdx: userTurnIdx,
          reply: outcome.text,
          corrections: [],
          modelUsed: null,
          degraded: true,
          unavailable: true,
        }
      : {
          turnIdx: userTurnIdx,
          reply: outcome.text,
          corrections,
          modelUsed: outcome.model,
          degraded: false,
        };
  }

  /** Preferencia del rol `chat`; `null` si el usuario no eligió modelo. */
  private async findPreference(userId: string): Promise<ModelPreference | null> {
    const preference = await this.sessions.findChatModelPreference(userId);
    return preference === null
      ? null
      : { provider: preference.provider, model: preference.model };
  }

  /** Borrado best-effort: nunca debe tapar el error original. */
  private async rollbackUserTurn(sessionId: string, idx: number): Promise<void> {
    try {
      await this.turns.deleteTurn(sessionId, idx);
    } catch (error) {
      this.logger.warn(
        `No se pudo deshacer el turno ${idx} de la sesión ${sessionId}: ` +
          `${(error as Error).message}`,
      );
    }
  }
}

/** Recorte defensivo al CHECK de 140 caracteres de `corrections.note`. */
function clampNote(note: string | null | undefined): string | null {
  if (note === null || note === undefined) {
    return null;
  }
  return note.length > CORRECTION_NOTE_MAX_CHARS
    ? note.slice(0, CORRECTION_NOTE_MAX_CHARS)
    : note;
}
