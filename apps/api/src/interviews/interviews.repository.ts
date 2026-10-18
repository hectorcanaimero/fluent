import { Inject, Injectable } from '@nestjs/common';
import type { InsForgeClient } from '@insforge/sdk';
import { INSFORGE_ADMIN_CLIENT } from '../insforge/insforge.constants.js';
import { unwrapInsforge } from '../insforge/insforge-result.js';
import {
  TABLES,
  type Interview,
  type Session,
  type StudyCycle,
  type StudyCycleSession,
} from '../db/schema.js';
import { markInterviewFeedbackFailed } from '../jobs/interviews/interview-jobs.shared.js';
import type { InterviewType, StudyPlanItem } from './interviews.types.js';

/** El ciclo con sus sesiones ordenadas por `idx` (F13.1.T1). */
export interface StudyCycleWithSessions {
  readonly cycle: StudyCycle;
  readonly sessions: readonly StudyCycleSession[];
}

type AdminDatabase = InsForgeClient['database'];

/** Fila a insertar al crear una entrevista (I2, `POST /interviews`). */
export interface CreateInterviewRow {
  readonly userId: string;
  readonly type: InterviewType;
  readonly offerText: string | null;
  readonly offerUrl: string | null;
  readonly offerHash: string;
}

/** Columnas que necesita `GET /interviews` (sin oferta, plan ni feedback). */
const LIST_COLUMNS =
  'id, type, status, prep_step, created_at, company, role, parent_interview_id, answered_count';

/** Tope de filas de `GET /interviews`. ponytail: sin paginación hasta que haga falta. */
const LIST_LIMIT = 100;

export type InterviewListRow = Pick<
  Interview,
  | 'id'
  | 'type'
  | 'status'
  | 'prep_step'
  | 'created_at'
  | 'company'
  | 'role'
  | 'parent_interview_id'
  | 'answered_count'
>;

/**
 * Todo el acceso a datos del módulo `interviews` (I2) sobre el cliente admin
 * de InsForge.
 *
 * **Aislamiento entre usuarios:** la clave admin no aplica RLS, así que toda
 * lectura de una entrevista concreta filtra siempre por `id` **y** `user_id`
 * (mismo criterio que `SessionsRepository`): un `id` de otro usuario debe
 * comportarse como si no existiera (404), nunca como un 403.
 */
@Injectable()
export class InterviewsRepository {
  constructor(@Inject(INSFORGE_ADMIN_CLIENT) private readonly admin: InsForgeClient) {}

  /** Inserta la entrevista en `preparing`/`reading` y devuelve la fila completa. */
  async create(row: CreateInterviewRow): Promise<Interview> {
    const result = await this.admin.database
      .from(TABLES.interviews)
      .insert({
        user_id: row.userId,
        type: row.type,
        offer_text: row.offerText,
        offer_url: row.offerUrl,
        offer_hash: row.offerHash,
        status: 'preparing',
        prep_step: 'reading',
      })
      .select('*')
      .maybeSingle();

    const created = unwrapInsforge<Interview>(result);
    if (created === null) {
      throw new Error('InterviewsRepository.create: la inserción no devolvió ninguna fila');
    }
    return created;
  }

  /** Entrevista por id, solo si es del usuario; `null` si no existe o es de otro. */
  async findById(userId: string, id: string): Promise<Interview | null> {
    const result = await this.admin.database
      .from(TABLES.interviews)
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    return unwrapInsforge<Interview>(result);
  }

  /** Entrevistas del usuario, más nueva primero (I2, `GET /interviews`, FR-31). */
  async listByUser(userId: string): Promise<InterviewListRow[]> {
    const result = await this.admin.database
      .from(TABLES.interviews)
      .select(LIST_COLUMNS)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(LIST_LIMIT);

    return unwrapInsforge<InterviewListRow[]>(result) ?? [];
  }

  /**
   * Vuelve a poner en `preparing`/`reading` una entrevista en `prep_failed`
   * (`POST /interviews/:id/retry`, NFR-6). El filtro `.eq('status',
   * 'prep_failed')` hace la transición atómica: `null` significa que ya no
   * estaba en ese estado (otro reintento concurrente, o nunca lo estuvo), y
   * quien llama lo trata como «no se puede reintentar».
   */
  async markRetrying(userId: string, id: string): Promise<Interview | null> {
    const result = await this.admin.database
      .from(TABLES.interviews)
      .update({ status: 'preparing', prep_step: 'reading', error_code: null })
      .eq('id', id)
      .eq('user_id', userId)
      .eq('status', 'prep_failed')
      .select('*')
      .maybeSingle();

    return unwrapInsforge<Interview>(result);
  }

  /**
   * `preparing` → `prep_failed` con `errorCode` (p. ej. `enqueue_failed` si
   * no se pudo encolar el job). Solo desde `preparing`, para no pisar lo que
   * el worker ya haya escrito.
   */
  async markPrepFailed(userId: string, id: string, errorCode: string): Promise<void> {
    const result = await this.admin.database
      .from(TABLES.interviews)
      .update({ status: 'prep_failed', prep_step: null, error_code: errorCode })
      .eq('id', id)
      .eq('user_id', userId)
      .eq('status', 'preparing');

    unwrapInsforge(result);
  }

  /**
   * `feedback_failed` → `feedback_pending` (`POST /interviews/:id/retry`,
   * F12.3.T1): mismo criterio atómico que `markRetrying`, por eso es un
   * método separado y no el mismo `markRetrying` con otro `from`: los dos
   * estados de fallo (`prep_failed`/`feedback_failed`) reintentan a jobs
   * distintos con payloads distintos.
   */
  async markFeedbackRetrying(userId: string, id: string): Promise<Interview | null> {
    const result = await this.admin.database
      .from(TABLES.interviews)
      .update({ status: 'feedback_pending', error_code: null })
      .eq('id', id)
      .eq('user_id', userId)
      .eq('status', 'feedback_failed')
      .select('*')
      .maybeSingle();

    return unwrapInsforge<Interview>(result);
  }

  /**
   * `feedback_pending` → `feedback_failed` (encolado del reintento fallido).
   * Solo desde `feedback_pending`, igual que `markPrepFailed`.
   */
  async markFeedbackFailed(userId: string, id: string, errorCode: string): Promise<void> {
    await markInterviewFeedbackFailed(this.admin.database, id, errorCode, userId);
  }

  /**
   * Crea el ciclo y sus 5 sesiones desde el `studyPlan` (F13.1.T1).
   * Idempotente y sin carreras: los dos `upsert` ignoran duplicados
   * (`UNIQUE (interview_id)` y `UNIQUE (cycle_id, idx)`), así que dos POST a
   * la vez —o uno que se cortó entre las dos escrituras— acaban en una sola
   * fila con sus 5 sesiones.
   */
  async upsertCycle(
    userId: string,
    interviewId: string,
    plan: readonly StudyPlanItem[],
  ): Promise<StudyCycleWithSessions> {
    unwrapInsforge(
      await this.admin.database
        .from(TABLES.studyCycles)
        .upsert(
          { user_id: userId, interview_id: interviewId, status: 'active' },
          { onConflict: 'interview_id', ignoreDuplicates: true },
        ),
    );
    const cycle = await this.findCycleRow(userId, interviewId);
    if (cycle === null) {
      throw new Error('InterviewsRepository.upsertCycle: el ciclo no quedó escrito');
    }
    unwrapInsforge(
      await this.admin.database.from(TABLES.studyCycleSessions).upsert(
        plan.map((item) => ({
          cycle_id: cycle.id,
          idx: item.idx,
          focus: item.focus,
          title: item.title,
          format: item.format,
          est_min: item.estMin,
          brief: item.brief,
        })),
        { onConflict: 'cycle_id,idx', ignoreDuplicates: true },
      ),
    );
    return { cycle, sessions: await this.listCycleSessions(cycle.id) };
  }

  /** Ciclo de la entrevista con sus sesiones; `null` si no existe o es de otro. */
  async findCycle(userId: string, interviewId: string): Promise<StudyCycleWithSessions | null> {
    const cycle = await this.findCycleRow(userId, interviewId);
    return cycle === null ? null : { cycle, sessions: await this.listCycleSessions(cycle.id) };
  }

  /** Sesión `study` activa enlazada a su fila del ciclo (`topic = title`). */
  async createStudySession(userId: string, row: StudyCycleSession): Promise<Session> {
    const result = await this.admin.database
      .from(TABLES.sessions)
      .insert({
        user_id: userId,
        kind: 'study',
        topic: row.title,
        study_cycle_session_id: row.id,
        status: 'active',
      })
      .select('*')
      .maybeSingle();

    const created = unwrapInsforge<Session>(result);
    if (created === null) {
      throw new Error('InterviewsRepository.createStudySession: la inserción no devolvió ninguna fila');
    }
    return created;
  }

  private async findCycleRow(userId: string, interviewId: string): Promise<StudyCycle | null> {
    const result = await this.admin.database
      .from(TABLES.studyCycles)
      .select('*')
      .eq('interview_id', interviewId)
      .eq('user_id', userId)
      .maybeSingle();
    return unwrapInsforge<StudyCycle>(result);
  }

  private async listCycleSessions(cycleId: string): Promise<StudyCycleSession[]> {
    const result = await this.admin.database
      .from(TABLES.studyCycleSessions)
      .select('*')
      .eq('cycle_id', cycleId)
      .order('idx', { ascending: true });
    return unwrapInsforge<StudyCycleSession[]>(result) ?? [];
  }
}

/**
 * Cierre de una sesión `study` (F13.1.T1): marca `done_at` en su fila del
 * ciclo y, con las 5 hechas, pasa el ciclo a `completed`. Función suelta (no
 * método) porque la llama `SessionCloserService`, que también vive en el
 * worker del sweeper sin el módulo `interviews` (mismo patrón que
 * `markInterviewFeedbackFailed`). No-op para cualquier otra sesión.
 */
export async function markStudySessionDone(db: AdminDatabase, sessionId: string): Promise<void> {
  const session = unwrapInsforge<Pick<Session, 'kind' | 'study_cycle_session_id'>>(
    await db
      .from(TABLES.sessions)
      .select('kind, study_cycle_session_id')
      .eq('id', sessionId)
      .maybeSingle(),
  );
  if (session?.kind !== 'study' || session.study_cycle_session_id === null) return;

  const row = unwrapInsforge<Pick<StudyCycleSession, 'cycle_id' | 'done_at'>>(
    await db
      .from(TABLES.studyCycleSessions)
      .select('cycle_id, done_at')
      .eq('id', session.study_cycle_session_id)
      .maybeSingle(),
  );
  if (row === null) return;
  // Repetir una sesión ya hecha no mueve su `done_at` original.
  if (row.done_at === null) {
    unwrapInsforge(
      await db
        .from(TABLES.studyCycleSessions)
        .update({ done_at: new Date().toISOString() })
        .eq('id', session.study_cycle_session_id),
    );
  }

  const all =
    unwrapInsforge<Pick<StudyCycleSession, 'done_at'>[]>(
      await db.from(TABLES.studyCycleSessions).select('done_at').eq('cycle_id', row.cycle_id),
    ) ?? [];
  if (all.length === STUDY_CYCLE_SIZE && all.every((item) => item.done_at !== null)) {
    unwrapInsforge(
      await db
        .from(TABLES.studyCycles)
        .update({ status: 'completed' })
        .eq('id', row.cycle_id)
        .eq('status', 'active'),
    );
  }
}

/** Sesiones de un ciclo (FR-17, invariante de `studyPlan` en I1). */
export const STUDY_CYCLE_SIZE = 5;
