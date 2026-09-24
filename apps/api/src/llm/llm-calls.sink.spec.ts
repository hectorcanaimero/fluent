import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { InsForgeClient } from '@insforge/sdk';
import type { Env } from '../config/env.js';
import { InsforgeLlmCallSink, toPromptVersion } from './llm-calls.sink.js';
import type { LlmCallRecord } from './llm.service.js';

const DEFAULT_PROMPT_VERSION = 7;

function makeRecord(overrides: Partial<LlmCallRecord> = {}): LlmCallRecord {
  return {
    userId: '11111111-1111-4111-8111-111111111111',
    sessionId: '33333333-3333-4333-8333-333333333333',
    purpose: 'turn',
    provider: '9router',
    model: 'google/gemma-3-27b-it:free',
    tokensIn: 900,
    tokensOut: 120,
    latencyMs: 1234,
    status: 'ok',
    attempt: 2,
    promptVersion: '3',
    ...overrides,
  };
}

function createSink(insert: ReturnType<typeof vi.fn>) {
  const admin = {
    database: { from: vi.fn(() => ({ insert })) },
  } as unknown as InsForgeClient;

  const configService = {
    get: () => DEFAULT_PROMPT_VERSION,
  } as unknown as ConfigService<Env, true>;

  return { sink: new InsforgeLlmCallSink(admin, configService), admin };
}

describe('toPromptVersion', () => {
  it('parses the integer version of the record', () => {
    expect(toPromptVersion('3', DEFAULT_PROMPT_VERSION)).toBe(3);
  });

  it('falls back to PROMPT_VERSION for null, empty or non-integer values', () => {
    expect(toPromptVersion(null, DEFAULT_PROMPT_VERSION)).toBe(DEFAULT_PROMPT_VERSION);
    expect(toPromptVersion('   ', DEFAULT_PROMPT_VERSION)).toBe(DEFAULT_PROMPT_VERSION);
    expect(toPromptVersion('v3', DEFAULT_PROMPT_VERSION)).toBe(DEFAULT_PROMPT_VERSION);
    expect(toPromptVersion('1.5', DEFAULT_PROMPT_VERSION)).toBe(DEFAULT_PROMPT_VERSION);
    expect(toPromptVersion('-1', DEFAULT_PROMPT_VERSION)).toBe(DEFAULT_PROMPT_VERSION);
  });
});

describe('InsforgeLlmCallSink (llm_calls, SPEC-01 §2.14)', () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes the row with the snake_case column names of the table', async () => {
    const insert = vi.fn(async () => ({ data: null, error: null }));
    const { sink, admin } = createSink(insert);

    await sink.record(makeRecord());

    expect(admin.database.from).toHaveBeenCalledWith('llm_calls');
    expect(insert).toHaveBeenCalledWith({
      user_id: '11111111-1111-4111-8111-111111111111',
      session_id: '33333333-3333-4333-8333-333333333333',
      purpose: 'turn',
      provider: '9router',
      model: 'google/gemma-3-27b-it:free',
      tokens_in: 900,
      tokens_out: 120,
      latency_ms: 1234,
      status: 'ok',
      attempt: 2,
      prompt_version: 3,
    });
  });

  it('uses the configured PROMPT_VERSION when the record has none', async () => {
    const insert = vi.fn(async () => ({ data: null, error: null }));
    const { sink } = createSink(insert);

    await sink.record(makeRecord({ promptVersion: null }));

    expect(insert.mock.calls[0]?.[0]).toMatchObject({ prompt_version: DEFAULT_PROMPT_VERSION });
  });

  it('keeps the null columns of a failed attempt (never invents zeros)', async () => {
    const insert = vi.fn(async () => ({ data: null, error: null }));
    const { sink } = createSink(insert);

    await sink.record(
      makeRecord({ status: 'timeout', tokensIn: null, tokensOut: null, sessionId: null }),
    );

    expect(insert.mock.calls[0]?.[0]).toMatchObject({
      status: 'timeout',
      tokens_in: null,
      tokens_out: null,
      session_id: null,
    });
  });

  it('does NOT throw when InsForge returns an error (observabilidad, no camino crítico)', async () => {
    const insert = vi.fn(async () => ({ data: null, error: { message: 'columna inexistente' } }));
    const { sink } = createSink(insert);

    await expect(sink.record(makeRecord())).resolves.toBeUndefined();
  });

  it('does NOT throw when the insert itself rejects', async () => {
    const insert = vi.fn(async () => {
      throw new Error('InsForge caído');
    });
    const { sink } = createSink(insert);

    await expect(sink.record(makeRecord())).resolves.toBeUndefined();
  });
});
