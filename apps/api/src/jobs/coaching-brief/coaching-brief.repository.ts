/**
 * Acceso a datos del job `coaching-brief` (SPEC-05 §2).
 *
 * Deliberadamente estrecho: solo las lecturas y escrituras que necesita este
 * job, no un repositorio genérico de todas las tablas. La clase abstracta hace
 * de contrato y de token de inyección, de modo que los tests sustituyen la
 * implementación de InsForge por un doble sin tocar el servicio.
 */
import { Inject, Injectable } from '@nestjs/common';
import type { InsForgeClient } from '@insforge/sdk';

import { INSFORGE_ADMIN_CLIENT } from '../../insforge/insforge.constants.js';
import { TABLES } from '../../db/schema.js';
import type {
  BriefJobStatus,
  Level,
  Locale,
  Provider,
  SessionKind,
  TurnRole,
} from '../../db/schema.js';
import { RPC, type ApplyBriefArgs, type ApplyBriefResult } from '../../db/rpc.js';
import type { EncryptedCredential } from '../../credentials/credentials.crypto.js';

/* ============================================================================
   Formas mínimas que el job necesita de cada tabla
   ========================================================================== */

export interface BriefSessionRow {
  readonly id: string;
  readonly user_id: string;
  readonly kind: SessionKind;
  readonly topic: string;
  readonly brief_job_status: BriefJobStatus;
}

export interface BriefTurnRow {
  readonly role: TurnRole;
  readonly text: string;
}

export interface BriefProfileRow {
  readonly level: Level;
  readonly locale: Locale;
  readonly suggested_level: Level | null;
}

export interface BriefModelPreferenceRow {
  readonly brief_provider: Provider;
  readonly brief_model: string;
}

export interface BriefCredentialRow extends EncryptedCredential {
  readonly provider: Provider;
}

/* ============================================================================
   Contrato
   ========================================================================== */

@Injectable()
export abstract class CoachingBriefRepository {
  abstract loadSession(sessionId: string): Promise<BriefSessionRow | null>;
  abstract markSessionRunning(sessionId: string): Promise<void>;
  /** Deja `brief_job_status = 'failed'` al agotarse los reintentos (MAL-20). */
  abstract markSessionFailed(sessionId: string): Promise<void>;
  abstract loadTurns(sessionId: string): Promise<BriefTurnRow[]>;
  abstract loadProfile(userId: string): Promise<BriefProfileRow | null>;
  /** Texto del brief vigente del usuario, o `null` si aún no tiene. */
  abstract loadCurrentBriefText(userId: string): Promise<string | null>;
  /** Texto de los hechos `confirmed` y `pending`, para `knownFacts` del prompt. */
  abstract loadKnownFacts(userId: string): Promise<string[]>;
  abstract loadModelPreference(
    userId: string,
  ): Promise<BriefModelPreferenceRow | null>;
  abstract loadActiveCredentials(userId: string): Promise<BriefCredentialRow[]>;
  abstract applyBrief(args: ApplyBriefArgs): Promise<ApplyBriefResult>;
  /** `level_hint` de las N entradas más recientes de `coaching_brief_history`. */
  abstract recentHistoryLevelHints(
    userId: string,
    limit: number,
  ): Promise<(Level | null)[]>;
  abstract updateSuggestedLevel(userId: string, level: Level): Promise<void>;
}

/* ============================================================================
   Implementación contra InsForge (PostgREST) con el cliente admin
   ========================================================================== */

interface PostgrestLike<T> {
  data: T | null;
  error: { message?: string } | null;
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
export class InsforgeCoachingBriefRepository extends CoachingBriefRepository {
  constructor(
    @Inject(INSFORGE_ADMIN_CLIENT) private readonly client: InsForgeClient,
  ) {
    super();
  }

  private get db() {
    return this.client.database;
  }

  async loadSession(sessionId: string): Promise<BriefSessionRow | null> {
    const result = await this.db
      .from(TABLES.sessions)
      .select('id,user_id,kind,topic,brief_job_status')
      .eq('id', sessionId)
      .maybeSingle();
    return unwrap(result as PostgrestLike<BriefSessionRow>, 'leer la sesión');
  }

  async markSessionRunning(sessionId: string): Promise<void> {
    const result = await this.db
      .from(TABLES.sessions)
      .update({ brief_job_status: 'running' satisfies BriefJobStatus })
      .eq('id', sessionId);
    unwrap(result as PostgrestLike<unknown>, 'marcar la sesión como running');
  }

  /**
   * Marca la sesión como `failed` cuando el job agota sus reintentos
   * (MAL-20). Sin esto la fila se quedaba en `running` para siempre y nadie
   * volvía a intentarlo: el aprendiz perdía el brief de esa sesión y las
   * siguientes arrancaban sin notas de coaching, en silencio.
   */
  async markSessionFailed(sessionId: string): Promise<void> {
    const result = await this.db
      .from(TABLES.sessions)
      .update({ brief_job_status: 'failed' satisfies BriefJobStatus })
      .eq('id', sessionId);
    unwrap(result as PostgrestLike<unknown>, 'marcar la sesión como failed');
  }

  async loadTurns(sessionId: string): Promise<BriefTurnRow[]> {
    const result = await this.db
      .from(TABLES.turns)
      .select('role,text')
      .eq('session_id', sessionId)
      .order('idx', { ascending: true });
    return unwrap(result as PostgrestLike<BriefTurnRow[]>, 'leer los turnos') ?? [];
  }

  async loadProfile(userId: string): Promise<BriefProfileRow | null> {
    const result = await this.db
      .from(TABLES.profiles)
      .select('level,locale,suggested_level')
      .eq('user_id', userId)
      .maybeSingle();
    return unwrap(result as PostgrestLike<BriefProfileRow>, 'leer el perfil');
  }

  async loadCurrentBriefText(userId: string): Promise<string | null> {
    const result = await this.db
      .from(TABLES.coachingBriefs)
      .select('text')
      .eq('user_id', userId)
      .maybeSingle();
    const row = unwrap(
      result as PostgrestLike<{ text: string }>,
      'leer el brief actual',
    );
    return row?.text ?? null;
  }

  async loadKnownFacts(userId: string): Promise<string[]> {
    const result = await this.db
      .from(TABLES.facts)
      .select('text')
      .eq('user_id', userId)
      .in('status', ['confirmed', 'pending']);
    const rows =
      unwrap(result as PostgrestLike<{ text: string }[]>, 'leer los hechos') ?? [];
    return rows.map((row) => row.text);
  }

  async loadModelPreference(
    userId: string,
  ): Promise<BriefModelPreferenceRow | null> {
    const result = await this.db
      .from(TABLES.modelPreferences)
      .select('brief_provider,brief_model')
      .eq('user_id', userId)
      .maybeSingle();
    return unwrap(
      result as PostgrestLike<BriefModelPreferenceRow>,
      'leer las preferencias de modelo',
    );
  }

  async loadActiveCredentials(userId: string): Promise<BriefCredentialRow[]> {
    const result = await this.db
      .from(TABLES.providerCredentials)
      .select('provider,key_ciphertext,key_iv,key_tag')
      .eq('user_id', userId)
      .eq('status', 'active');
    return (
      unwrap(
        result as PostgrestLike<BriefCredentialRow[]>,
        'leer las credenciales',
      ) ?? []
    );
  }

  async applyBrief(args: ApplyBriefArgs): Promise<ApplyBriefResult> {
    const result = await this.db.rpc(RPC.applyBrief, {
      ...args,
    } as unknown as Record<string, unknown>);
    const data = unwrap(
      result as PostgrestLike<ApplyBriefResult>,
      'aplicar el brief',
    );
    if (!data) {
      throw new Error('apply_brief no devolvió resultado');
    }
    return data;
  }

  async recentHistoryLevelHints(
    userId: string,
    limit: number,
  ): Promise<(Level | null)[]> {
    const result = await this.db
      .from(TABLES.coachingBriefHistory)
      .select('level_hint')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(limit);
    const rows =
      unwrap(
        result as PostgrestLike<{ level_hint: Level | null }[]>,
        'leer el histórico de briefs',
      ) ?? [];
    return rows.map((row) => row.level_hint);
  }

  async updateSuggestedLevel(userId: string, level: Level): Promise<void> {
    const result = await this.db
      .from(TABLES.profiles)
      .update({ suggested_level: level })
      .eq('user_id', userId);
    unwrap(result as PostgrestLike<unknown>, 'guardar suggested_level');
  }
}
