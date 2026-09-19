import type { PushService } from '../../push/push.service.js';
import { randomBytes, createCipheriv } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';

import { CredentialsCrypto, credentialAad } from '../../credentials/credentials.crypto.js';
import type { Provider } from '../../db/schema.js';
import { LlmUnavailableError, type LlmService } from '../../llm/llm.service.js';
import type { WeeklyLeaderboardEntry } from '../../db/rpc.js';
import {
  WeeklySummaryNoOwnerCredentialError,
  WeeklySummaryService,
} from './weekly-summary.service.js';
import type { WeeklySummaryRepository } from './weekly-summary.repository.js';
import type { WeeklySummaryPendingCredentialStore } from './pending-credential.store.js';

const GROUP_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_ID = '22222222-2222-4222-8222-222222222222';
const WEEK_START = '2026-09-07';
const MASTER_KEY = randomBytes(32);

function encryptedKey(plaintext: string, provider: Provider = 'openrouter') {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', MASTER_KEY, iv);
  cipher.setAAD(Buffer.from(credentialAad(OWNER_ID, provider), 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    provider: provider as 'openrouter',
    key_ciphertext: `\\x${ciphertext.toString('hex')}`,
    key_iv: `\\x${iv.toString('hex')}`,
    key_tag: `\\x${cipher.getAuthTag().toString('hex')}`,
  };
}

function makeCipher(): CredentialsCrypto {
  const values: Record<string, string | undefined> = {
    CREDENTIALS_MASTER_KEY: MASTER_KEY.toString('base64'),
    CREDENTIALS_MASTER_KEY_PREVIOUS: undefined,
  };
  return new CredentialsCrypto({
    get: (key: string) => values[key],
  } as unknown as ConfigService<never, true>);
}

function makeConfig(promptVersion = 3): ConfigService<never, true> {
  return {
    get: (key: string) => (key === 'PROMPT_VERSION' ? promptVersion : undefined),
  } as unknown as ConfigService<never, true>;
}

const LEADERBOARD: WeeklyLeaderboardEntry[] = [
  { user_id: 'u1', display_name: 'Ana', xp: 120, sessions: 4, rank: 1 },
  { user_id: 'u2', display_name: 'Beto', xp: 40, sessions: 1, rank: 2 },
];

interface RepoOverrides {
  summaryExists?: boolean;
  group?: { id: string; owner_id: string | null; group_streak: number } | null;
  credentialRows?: ReturnType<typeof encryptedKey>[];
}

function makeRepository(overrides: RepoOverrides = {}) {
  const group = overrides.group ?? {
    id: GROUP_ID,
    owner_id: OWNER_ID,
    group_streak: 5,
  };

  return {
    listGroupIds: vi.fn(async () => [GROUP_ID]),
    loadGroup: vi.fn(async () => group),
    summaryExists: vi.fn(async () => overrides.summaryExists ?? false),
    loadLeaderboard: vi.fn(async () => LEADERBOARD),
    loadMemberTopics: vi.fn(async (userId: string) =>
      userId === 'u1' ? ['travel', 'travel', 'food'] : ['sports'],
    ),
    loadMemberStreak: vi.fn(async () => 2),
    loadOwnerActiveCredentials: vi.fn(
      async () => overrides.credentialRows ?? [encryptedKey('sk-or-v1-test')],
    ),
    loadOwnerModelPreference: vi.fn(async () => ({
      brief_provider: 'openrouter' as const,
      brief_model: 'anthropic/claude-3.5-sonnet',
    })),
    loadOwnerLocale: vi.fn(async () => 'es' as const),
    insertWeeklySummary: vi.fn(async () => {}),
  };
}

function makeLlm(overrides?: Partial<Record<string, unknown>>): LlmService {
  return {
    complete: vi.fn(async () => ({
      data: { text: 'GG team! Ana crushed it this week 🎉' },
      modelUsed: 'anthropic/claude-3.5-sonnet',
      provider: 'openrouter' as const,
      usage: { tokensIn: 80, tokensOut: 40 },
      degraded: false,
      attempts: [],
    })),
    ...overrides,
  } as unknown as LlmService;
}

function makePendingStore() {
  return {
    markMissing: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
  };
}

/** PushService falso: registra los avisos del resumen semanal. */
function fakePush() {
  return { notifyWeeklySummary: vi.fn(async () => undefined) } as unknown as PushService;
}

describe('WeeklySummaryService (SPEC-05 §4)', () => {
  it('sale sin llamar al LLM si ya existe el resumen de la semana', async () => {
    const repository = makeRepository({ summaryExists: true });
    const llm = makeLlm();
    const pending = makePendingStore();
    const service = new WeeklySummaryService(
      repository as unknown as WeeklySummaryRepository,
      makeCipher(),
      llm,
      pending as unknown as WeeklySummaryPendingCredentialStore,
      makeConfig(),
      fakePush(),
    );

    const result = await service.run(GROUP_ID, WEEK_START);

    expect(result).toEqual({ status: 'skipped', reason: 'already_exists' });
    expect(llm.complete).not.toHaveBeenCalled();
    expect(repository.loadGroup).not.toHaveBeenCalled();
  });

  it('sin credencial activa del owner: marca la clave de Redis y lanza para reintento', async () => {
    const repository = makeRepository({ credentialRows: [] });
    const llm = makeLlm();
    const pending = makePendingStore();
    const service = new WeeklySummaryService(
      repository as unknown as WeeklySummaryRepository,
      makeCipher(),
      llm,
      pending as unknown as WeeklySummaryPendingCredentialStore,
      makeConfig(),
      fakePush(),
    );

    await expect(service.run(GROUP_ID, WEEK_START)).rejects.toBeInstanceOf(
      WeeklySummaryNoOwnerCredentialError,
    );

    expect(llm.complete).not.toHaveBeenCalled();
    expect(repository.insertWeeklySummary).not.toHaveBeenCalled();
    expect(pending.markMissing).toHaveBeenCalledWith(OWNER_ID, {
      groupId: GROUP_ID,
      weekStart: WEEK_START,
    });
  });

  it('sin owner_id: lanza sin escribir ninguna clave de Redis (no hay a quién avisar)', async () => {
    const repository = makeRepository({
      group: { id: GROUP_ID, owner_id: null, group_streak: 0 },
    });
    const llm = makeLlm();
    const pending = makePendingStore();
    const service = new WeeklySummaryService(
      repository as unknown as WeeklySummaryRepository,
      makeCipher(),
      llm,
      pending as unknown as WeeklySummaryPendingCredentialStore,
      makeConfig(),
      fakePush(),
    );

    await expect(service.run(GROUP_ID, WEEK_START)).rejects.toBeInstanceOf(
      WeeklySummaryNoOwnerCredentialError,
    );
    expect(pending.markMissing).not.toHaveBeenCalled();
    expect(llm.complete).not.toHaveBeenCalled();
  });

  it('con credencial activa: llama al LLM y guarda text/stats en weekly_summaries', async () => {
    const repository = makeRepository();
    const llm = makeLlm();
    const pending = makePendingStore();
    const service = new WeeklySummaryService(
      repository as unknown as WeeklySummaryRepository,
      makeCipher(),
      llm,
      pending as unknown as WeeklySummaryPendingCredentialStore,
      makeConfig(),
      fakePush(),
    );

    const result = await service.run(GROUP_ID, WEEK_START);

    expect(result).toMatchObject({ status: 'applied', membersCount: 2 });
    expect(llm.complete).toHaveBeenCalledOnce();

    const request = (llm.complete as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(request.purpose).toBe('weekly');
    expect(request.userId).toBe(OWNER_ID);
    expect(request.preference).toEqual({
      provider: 'openrouter',
      model: 'anthropic/claude-3.5-sonnet',
    });
    expect(request.credentials).toEqual([
      { provider: 'openrouter', apiKey: 'sk-or-v1-test' },
    ]);
    expect(request.promptVersion).toBe('3');

    expect(repository.insertWeeklySummary).toHaveBeenCalledWith({
      group_id: GROUP_ID,
      week_start: WEEK_START,
      // El pie de marca lo añade el código, no el LLM (MEJ-41).
      text: 'GG team! Ana crushed it this week 🎉\n\n— Fluent · practicá inglés con tus amigos',
      stats: {
        weekStart: WEEK_START,
        groupStreak: 5,
        members: [
          { name: 'Ana', xpWeek: 120, sessionsWeek: 4, streak: 2, topTopics: ['travel', 'food'] },
          { name: 'Beto', xpWeek: 40, sessionsWeek: 1, streak: 2, topTopics: ['sports'] },
        ],
      },
    });

    // Éxito: se limpia cualquier clave pendiente de una semana anterior.
    expect(pending.clear).toHaveBeenCalledWith(OWNER_ID);
  });

  it('propaga LlmUnavailableError para que BullMQ reintente', async () => {
    const repository = makeRepository();
    const llm = makeLlm({
      complete: vi.fn(async () => {
        throw new LlmUnavailableError([]);
      }),
    });
    const pending = makePendingStore();
    const service = new WeeklySummaryService(
      repository as unknown as WeeklySummaryRepository,
      makeCipher(),
      llm,
      pending as unknown as WeeklySummaryPendingCredentialStore,
      makeConfig(),
      fakePush(),
    );

    await expect(service.run(GROUP_ID, WEEK_START)).rejects.toBeInstanceOf(
      LlmUnavailableError,
    );
    expect(repository.insertWeeklySummary).not.toHaveBeenCalled();
  });
});

describe('WeeklySummaryService · pie de marca (MEJ-41)', () => {
  function buildService(
    repository: ReturnType<typeof makeRepository>,
    llm: LlmService = makeLlm(),
  ) {
    return new WeeklySummaryService(
      repository as unknown as WeeklySummaryRepository,
      makeCipher(),
      llm,
      makePendingStore() as unknown as WeeklySummaryPendingCredentialStore,
      makeConfig(),
      fakePush(),
    );
  }

  it('guarda el pie en pt-BR cuando el owner es de pt-BR', async () => {
    const repository = makeRepository();
    repository.loadOwnerLocale = vi.fn(async () => 'pt-BR' as const);

    await buildService(repository).run(GROUP_ID, WEEK_START);

    const [row] = repository.insertWeeklySummary.mock.calls[0]! as [{ text: string }];
    expect(row.text).toBe(
      'GG team! Ana crushed it this week 🎉\n\n— Fluent · pratique inglês com seus amigos',
    );
  });

  it('recorta el texto del LLM, no el pie, si el resumen viene al máximo', async () => {
    const repository = makeRepository();
    const llm = makeLlm({
      complete: vi.fn(async () => ({
        data: { text: 'a'.repeat(1200) },
        modelUsed: 'anthropic/claude-3.5-sonnet',
        provider: 'openrouter' as const,
        usage: { tokensIn: 80, tokensOut: 40 },
        degraded: false,
        attempts: [],
      })),
    });

    await buildService(repository, llm).run(GROUP_ID, WEEK_START);

    const [row] = repository.insertWeeklySummary.mock.calls[0]! as [{ text: string }];
    expect(row.text.length).toBeLessThanOrEqual(1200);
    expect(row.text.endsWith('— Fluent · practicá inglés con tus amigos')).toBe(true);
  });
});
