import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NestLlmEventBus } from '../llm/nest-llm-event-bus.js';
import { CREDENTIAL_ERROR_EVENT } from '../llm/llm-infra.constants.js';
import { CredentialErrorListener } from './credential-error.listener.js';
import type { CredentialsService } from './credentials.service.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';

function createListener(markCredentialError = vi.fn(async () => {})) {
  const credentialsService = { markCredentialError } as unknown as CredentialsService;
  return { listener: new CredentialErrorListener(credentialsService), markCredentialError };
}

describe('CredentialErrorListener (evento credential.error, SPEC-03 §2)', () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("marks the credential with last_error = 'AUTH_ERROR' for a 401/403", async () => {
    const { listener, markCredentialError } = createListener();

    await listener.handleCredentialError({
      userId: USER_ID,
      provider: 'openrouter',
      code: 'AUTH_ERROR',
    });

    expect(markCredentialError).toHaveBeenCalledWith(USER_ID, 'openrouter', 'AUTH_ERROR');
  });

  it("marks the credential with last_error = 'NO_CREDITS' for a 402", async () => {
    const { listener, markCredentialError } = createListener();

    await listener.handleCredentialError({
      userId: USER_ID,
      provider: 'openrouter',
      code: 'NO_CREDITS',
    });

    expect(markCredentialError).toHaveBeenCalledWith(USER_ID, 'openrouter', 'NO_CREDITS');
  });

  it('never propagates an error (runs outside the request cycle)', async () => {
    const { listener } = createListener(
      vi.fn(async () => {
        throw new Error('InsForge caído');
      }),
    );

    await expect(
      listener.handleCredentialError({ userId: USER_ID, provider: 'gemini', code: 'AUTH_ERROR' }),
    ).resolves.toBeUndefined();
  });

  it('the LlmEventBus of PR-03 reaches the listener through EventEmitter2', async () => {
    const emitter = new EventEmitter2();
    const { listener, markCredentialError } = createListener();
    emitter.on(CREDENTIAL_ERROR_EVENT, (payload) => listener.handleCredentialError(payload));

    new NestLlmEventBus(emitter).emit(CREDENTIAL_ERROR_EVENT, {
      userId: USER_ID,
      provider: 'gemini',
      code: 'AUTH_ERROR',
    });

    await vi.waitFor(() =>
      expect(markCredentialError).toHaveBeenCalledWith(USER_ID, 'gemini', 'AUTH_ERROR'),
    );
  });
});
