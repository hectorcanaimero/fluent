import { Inject, Injectable } from '@nestjs/common';
import type { InsForgeClient } from '@insforge/sdk';
import { INSFORGE_ADMIN_CLIENT } from '../insforge/insforge.constants.js';
import { unwrapInsforge } from '../insforge/insforge-result.js';
import { RPC, type PickCallbackFactResult } from '../db/rpc.js';
import {
  TABLES,
  type Fact,
  type NewsItem,
  type Profile,
  type Provider,
  type Session,
  type SessionKind,
} from '../db/schema.js';
import { MAX_FACTS_IN_PROMPT } from '../llm/config.js';
import { OPENING_TURN_IDX } from './sessions.constants.js';

/** Preferencia del rol `chat` de `model_preferences` (SPEC-01 §2.5, SPEC-03 §2). */
export interface ChatModelPreference {
  readonly provider: Provider;
  readonly model: string;
}

/** Fila a insertar en `sessions` al abrir (SPEC-04 §3.5). */
export interface CreateSessionRow {
  readonly userId: string;
  readonly kind: SessionKind;
  /** Etiqueta legible por humanos; nunca el `prompt_en` en inglés. */
  readonly topic: string;
  /** Solo se escribe con `kind = 'news'` (CHECK de la migración 3). */
  readonly newsItemId?: string | null;
  readonly challengeFromUserId?: string | null;
  /** MAL-24: corre con la credencial del owner del grupo. */
  readonly courtesy?: boolean;
}

/** Datos del turno de apertura del tutor (`turns[idx=0]`, SPEC-04 §3.5). */
export interface OpeningTurnRow {
  readonly sessionId: string;
  readonly text: string;
  /** Nulos en la apertura degradada: el CHECK de `turns` los permite. */
  readonly model?: string | null;
  readonly tokensIn?: number | null;
  readonly tokensOut?: number | null;
  readonly latencyMs?: number | null;
}

/**
 * Todo el acceso a datos de `POST /sessions` (SPEC-04 §3) sobre el cliente
 * admin de InsForge.
 *
 * **Aislamiento entre usuarios:** la clave admin no aplica RLS, así que toda
 * lectura o escritura de una sesión concreta filtra siempre por `id` **y**
 * `user_id` (mismo criterio que `MemoryRepository`, PEND-42 de
 * docs/specs/pendientes/PR-02.md). En esta tarea no hay ningún endpoint que
 * reciba un `sessionId` del cliente, pero `updateAfterOpening` y
 * `deleteSession` ya llevan el filtro doble para que T2/T3 no lo pierdan.
 */
@Injectable()
export class SessionsRepository {
  constructor(@Inject(INSFORGE_ADMIN_CLIENT) private readonly admin: InsForgeClient) {}

  /** Perfil del usuario, o `null` si nunca llamó a `GET /me` (SPEC-04 §3.1). */
  async findProfile(userId: string): Promise<Profile | null> {
    const result = await this.admin.database
      .from(TABLES.profiles)
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    return unwrapInsforge<Profile>(result);
  }

  /**
   * Id de la sesión `active` del usuario, si la hay (SPEC-04 §2: «solo puede
   * haber una sesión `active` por usuario»). La más reciente por `started_at`,
   * por si un bug histórico dejó más de una.
   */
  async findActiveSessionId(userId: string): Promise<string | null> {
    const result = await this.admin.database
      .from(TABLES.sessions)
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return unwrapInsforge<{ id: string }>(result)?.id ?? null;
  }

  /**
   * Preferencia de modelo del rol `chat` (SPEC-03 §2 paso 1). `null` si el
   * usuario no tiene fila en `model_preferences`: entonces `ModelResolver` usa
   * directamente la cadena gratuita del operador.
   */
  async findChatModelPreference(userId: string): Promise<ChatModelPreference | null> {
    const result = await this.admin.database
      .from(TABLES.modelPreferences)
      .select('chat_provider, chat_model')
      .eq('user_id', userId)
      .maybeSingle();

    const row = unwrapInsforge<{ chat_provider: Provider; chat_model: string }>(result);
    if (row === null) {
      return null;
    }
    return { provider: row.chat_provider, model: row.chat_model };
  }

  /** Noticia por id, o `null` si no existe (SPEC-04 §3.2). */
  async findNewsItem(newsItemId: string): Promise<NewsItem | null> {
    const result = await this.admin.database
      .from(TABLES.newsItems)
      .select('*')
      .eq('id', newsItemId)
      .maybeSingle();

    return unwrapInsforge<NewsItem>(result);
  }

  /** Texto del `coaching_briefs` del usuario, o `null` si aún no tiene. */
  async findBriefText(userId: string): Promise<string | null> {
    const result = await this.admin.database
      .from(TABLES.coachingBriefs)
      .select('text')
      .eq('user_id', userId)
      .maybeSingle();

    return unwrapInsforge<{ text: string }>(result)?.text ?? null;
  }

  /**
   * Hechos `confirmed` del usuario para el prompt (SPEC-03 §3: «hasta 3
   * hechos»). Se piden los más recientes por `created_at`: es el criterio más
   * simple y el único que la base ya indexa por usuario; ver la decisión en
   * docs/specs/pendientes/PR-04.md.
   */
  async listConfirmedFacts(
    userId: string,
    limit: number = MAX_FACTS_IN_PROMPT,
  ): Promise<Fact[]> {
    const result = await this.admin.database
      .from(TABLES.facts)
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'confirmed')
      .order('created_at', { ascending: false })
      .limit(limit);

    return unwrapInsforge<Fact[]>(result) ?? [];
  }

  /**
   * `callback_fact_id` de la última sesión del usuario por `started_at`
   * (SPEC-04 §3.3: «y si la sesión anterior no usó callback»).
   * `{ found: false }` si el usuario no tiene ninguna sesión previa.
   */
  async findLastSessionCallback(
    userId: string,
  ): Promise<{ found: boolean; callbackFactId: string | null }> {
    const result = await this.admin.database
      .from(TABLES.sessions)
      .select('callback_fact_id')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const row = unwrapInsforge<{ callback_fact_id: string | null }>(result);
    if (row === null) {
      return { found: false, callbackFactId: null };
    }
    return { found: true, callbackFactId: row.callback_fact_id };
  }

  /**
   * `owner_id` del grupo del usuario, o `null` si no tiene grupo o el grupo
   * no tiene owner (MAL-24).
   */
  async findGroupOwnerId(groupId: string): Promise<string | null> {
    const result = await this.admin.database
      .from(TABLES.groups)
      .select('owner_id')
      .eq('id', groupId)
      .maybeSingle();

    const row = unwrapInsforge<{ owner_id: string | null }>(result);
    return row?.owner_id ?? null;
  }

  /**
   * Marca la sesión de cortesía como gastada (MAL-24), solo si aún estaba
   * libre. El `is` en el WHERE es lo que hace la operación idempotente
   * incluso con dos aperturas simultáneas: la segunda no encuentra fila que
   * actualizar.
   */
  async markCourtesySessionUsed(userId: string, at: Date = new Date()): Promise<boolean> {
    const result = await this.admin.database
      .from(TABLES.profiles)
      .update({ courtesy_session_used_at: at.toISOString() })
      .eq('user_id', userId)
      .is('courtesy_session_used_at', null)
      .select('user_id');

    const rows = unwrapInsforge<{ user_id: string }[]>(result) ?? [];
    return rows.length > 0;
  }

  /**
   * Devuelve la sesión de cortesía al usuario (MAL-24). Solo se usa cuando la
   * apertura falla por un error nuestro después de haberla consumido.
   */
  async releaseCourtesySession(userId: string): Promise<void> {
    const result = await this.admin.database
      .from(TABLES.profiles)
      .update({ courtesy_session_used_at: null })
      .eq('user_id', userId);

    unwrapInsforge(result);
  }

  /**
   * Última sesión cerrada del usuario cuyo brief quedó `failed` (MAL-20), si
   * terminó hace menos de `maxAgeDays` días.
   *
   * El límite de antigüedad existe para no reencolar indefinidamente el brief
   * de una sesión vieja: pasados unos días, sus notas de coaching ya no valen
   * gran cosa y reintentarlas solo gasta tokens del aprendiz.
   */
  async findRecentFailedBriefSessionId(
    userId: string,
    maxAgeDays: number,
    now: Date = new Date(),
  ): Promise<string | null> {
    const since = new Date(now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000);

    const result = await this.admin.database
      .from(TABLES.sessions)
      .select('id')
      .eq('user_id', userId)
      .eq('brief_job_status', 'failed')
      .gte('ended_at', since.toISOString())
      .order('ended_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const row = unwrapInsforge<{ id: string }>(result);
    return row?.id ?? null;
  }

  /**
   * RPC `pick_callback_fact` (SPEC-01 §5, RF-4.4). La función SQL ya marca
   * `last_used_at` y `use_count` del hecho elegido; devuelve la fila o `null`
   * si el usuario no tiene ningún hecho `confirmed`.
   */
  async pickCallbackFact(userId: string): Promise<Fact | null> {
    const result = await this.admin.database.rpc(RPC.pickCallbackFact, {
      p_user_id: userId,
    });

    if (result.error) {
      throw new Error(
        `Error de RPC pick_callback_fact: ${result.error.message} (code=${result.error.code ?? '?'})`,
        { cause: result.error },
      );
    }

    return (result.data as unknown as PickCallbackFactResult) ?? null;
  }

  /** Inserta la sesión en estado `active` y devuelve la fila completa. */
  async createSession(row: CreateSessionRow): Promise<Session> {
    const result = await this.admin.database
      .from(TABLES.sessions)
      .insert({
        user_id: row.userId,
        kind: row.kind,
        topic: row.topic,
        // CHECK `kind = 'news' OR news_item_id IS NULL` (migración 3).
        news_item_id: row.kind === 'news' ? (row.newsItemId ?? null) : null,
        challenge_from_user_id: row.challengeFromUserId ?? null,
        courtesy: row.courtesy ?? false,
        status: 'active',
      })
      .select('*')
      .maybeSingle();

    const created = unwrapInsforge<Session>(result);
    if (created === null) {
      throw new Error('createSession: la inserción no devolvió ninguna fila');
    }
    return created;
  }

  /**
   * Escribe lo que solo se sabe después de la llamada al LLM:
   * `chat_model_used` y `callback_fact_id`. Filtro doble `id` + `user_id`.
   */
  async updateAfterOpening(
    userId: string,
    sessionId: string,
    patch: { chatModelUsed?: string | null; callbackFactId?: string | null },
  ): Promise<Session | null> {
    const body: Record<string, unknown> = {};
    if (patch.chatModelUsed !== undefined) {
      body.chat_model_used = patch.chatModelUsed;
    }
    if (patch.callbackFactId !== undefined) {
      body.callback_fact_id = patch.callbackFactId;
    }

    const result = await this.admin.database
      .from(TABLES.sessions)
      .update(body)
      .eq('id', sessionId)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle();

    return unwrapInsforge<Session>(result);
  }

  /**
   * Borra una sesión recién creada. Solo se usa para no dejar una sesión
   * `active` huérfana si algo inesperado revienta entre el INSERT y el turno
   * de apertura (ver docs/specs/pendientes/PR-04.md): una sesión `active`
   * fantasma bloquearía al usuario con `SESSION_ALREADY_ACTIVE` hasta que el
   * barrido de PR-04/T5 la marcase `abandoned`.
   */
  async deleteSession(userId: string, sessionId: string): Promise<void> {
    const result = await this.admin.database
      .from(TABLES.sessions)
      .delete()
      .eq('id', sessionId)
      .eq('user_id', userId);

    unwrapInsforge(result);
  }

  /**
   * Turno de apertura del tutor (`idx = 0`, SPEC-04 §3.5). `turns_count` no se
   * toca: cuenta turnos **del usuario** (decisión de la sesión líder), y en la
   * apertura el aprendiz todavía no habló.
   */
  async insertOpeningTurn(row: OpeningTurnRow): Promise<void> {
    const result = await this.admin.database.from(TABLES.turns).insert({
      session_id: row.sessionId,
      idx: OPENING_TURN_IDX,
      role: 'tutor',
      text: row.text,
      model: row.model ?? null,
      tokens_in: row.tokensIn ?? null,
      tokens_out: row.tokensOut ?? null,
      latency_ms: row.latencyMs ?? null,
    });

    unwrapInsforge(result);
  }
}
