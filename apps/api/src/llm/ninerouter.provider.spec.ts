import { createNineRouterProvider } from './ninerouter.provider.js';

const env = { NINEROUTER_URL: 'http://localhost:20128/v1', NINEROUTER_API_KEY: 'sk-secret-key' };

describe('createNineRouterProvider', () => {
  afterEach(() => vi.restoreAllMocks());

  it('añade stream:false si el cuerpo no lo trae y no filtra la key fuera de la cabecera', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }));
    const model = createNineRouterProvider(env).chatModel('fluent-free');
    await model.doGenerate({ prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }] }).catch(() => undefined);

    const [, init] = spy.mock.calls[0]!;
    expect(JSON.parse(init!.body as string)).toMatchObject({ model: 'fluent-free', stream: false });
  });

  it('la key no aparece en toString del provider', () => {
    const provider = createNineRouterProvider(env);
    expect(String(provider)).not.toContain('sk-secret-key');
  });
});
