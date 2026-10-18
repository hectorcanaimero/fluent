import type { ConfigService } from '@nestjs/config';

import {
  AgentInvalidResponseError,
  AgentUnavailableError,
  InterviewAgentClient,
} from './interview-agent.client.js';
import type { PrepareRequest } from './interviews.types.js';

const BASE_URL = 'http://interview-agent.internal';
const TOKEN = 'sk-agent-secret';

function makeClient(overrides: { url?: string; token?: string } = {}): InterviewAgentClient {
  const config = {
    get: (key: string) => {
      if (key === 'INTERVIEW_AGENT_URL') return 'url' in overrides ? overrides.url : BASE_URL;
      if (key === 'INTERVIEW_AGENT_TOKEN') return 'token' in overrides ? overrides.token : TOKEN;
      return undefined;
    },
  } as unknown as ConfigService<never, true>;
  return new InterviewAgentClient(config);
}

function prepareRequest(): PrepareRequest {
  return {
    interviewId: '11111111-1111-4111-8111-111111111111',
    type: 'technical',
    offerText: 'We are hiring a backend engineer.',
    offerUrl: null,
    learnerLevel: 'B1',
    previousQuestions: [],
  };
}

/** Plan válido `technical` (0 behavioral), 4 competencias, 8 preguntas. */
function validPrepareOkBody() {
  return {
    status: 'ok',
    type: 'technical',
    company: { name: 'Acme' },
    role: 'Backend engineer',
    area: 'engineering',
    seniority: 'semi_senior',
    stack: ['node', 'postgres'],
    rubric: [
      { id: 'c1', name: 'APIs', expectedLevel: 'semi_senior', weight: 1 },
      { id: 'c2', name: 'Testing', expectedLevel: 'semi_senior', weight: 1 },
      { id: 'c3', name: 'Databases', expectedLevel: 'semi_senior', weight: 1 },
      { id: 'c4', name: 'System design', expectedLevel: 'semi_senior', weight: 1 },
    ],
    questions: Array.from({ length: 8 }, (_, i) => ({
      idx: i + 1,
      competencyId: `c${(i % 4) + 1}`,
      kind: 'technical',
      text: `Question ${i + 1}`,
    })),
    research: { found: true, notes: 'Found the company website.' },
    usage: { model: 'fluent-pro', inputTokens: 500, outputTokens: 300, searchCalls: 2 },
  };
}

describe('InterviewAgentClient', () => {
  afterEach(() => vi.restoreAllMocks());

  it('prepare() valida y devuelve una respuesta ok del agente', async () => {
    const body = validPrepareOkBody();
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));

    const client = makeClient();
    const result = await client.prepare(prepareRequest());

    expect(result).toMatchObject({ status: 'ok', role: 'Backend engineer' });
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe(`${BASE_URL}/v1/prepare`);
    expect(init?.headers).toMatchObject({ authorization: `Bearer ${TOKEN}` });
  });

  it('prepare() acepta la variante offer_unreadable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'offer_unreadable', reason: 'empty' }), { status: 200 }),
    );

    const client = makeClient();
    const result = await client.prepare(prepareRequest());

    expect(result).toEqual({ status: 'offer_unreadable', reason: 'empty' });
  });

  it('respuesta que no cumple el contrato -> AgentInvalidResponseError', async () => {
    const invalid = { ...validPrepareOkBody(), questions: [] };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(invalid), { status: 200 }),
    );

    const client = makeClient();
    await expect(client.prepare(prepareRequest())).rejects.toBeInstanceOf(AgentInvalidResponseError);
  });

  it('status fuera de 2xx -> AgentUnavailableError', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('boom', { status: 502 }));

    const client = makeClient();
    await expect(client.prepare(prepareRequest())).rejects.toBeInstanceOf(AgentUnavailableError);
  });

  it('status fuera de 2xx: el mensaje incluye un fragmento del cuerpo', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(`upstream exploded ${'x'.repeat(500)}`, { status: 500 }),
    );

    const client = makeClient();
    const error = await client.prepare(prepareRequest()).catch((e: Error) => e);
    expect(error).toBeInstanceOf(AgentUnavailableError);
    expect((error as Error).message).toContain('500 en /v1/prepare: upstream exploded');
    expect((error as Error).message.length).toBeLessThan(300);
  });

  it.each([
    ['http://agent.internal/', 'http://agent.internal/v1/prepare'],
    ['http://agent.internal/base', 'http://agent.internal/base/v1/prepare'],
    ['http://agent.internal/base/', 'http://agent.internal/base/v1/prepare'],
  ])('URL base %s -> %s (sin doble barra, respeta el prefijo)', async (url, expected) => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(validPrepareOkBody()), { status: 200 }));

    await makeClient({ url }).prepare(prepareRequest());

    expect(fetchSpy.mock.calls[0]![0]).toBe(expected);
  });

  it('error de red (timeout incluido) -> AgentUnavailableError', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('aborted'));

    const client = makeClient();
    await expect(client.prepare(prepareRequest())).rejects.toBeInstanceOf(AgentUnavailableError);
  });

  it('sin INTERVIEW_AGENT_URL/TOKEN -> AgentUnavailableError sin llamar a fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const client = makeClient({ url: undefined, token: undefined });

    await expect(client.prepare(prepareRequest())).rejects.toBeInstanceOf(AgentUnavailableError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
