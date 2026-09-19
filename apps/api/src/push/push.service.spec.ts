import { Logger } from '@nestjs/common';
import type { RedisService } from '../redis/redis.service.js';
import { challengeMessage, weeklySummaryMessage } from './push.messages.js';
import type { PushRepository, PushRecipient } from './push.repository.js';
import type { PushSender } from './push.sender.js';
import { PushService } from './push.service.js';

function setup(opts: {
  enabled?: boolean;
  peers?: string[];
  recipients?: PushRecipient[];
  invalidTokens?: string[];
  throttled?: Set<string>;
} = {}) {
  const sent: Array<{ tokens: readonly string[]; title: string }> = [];
  const repository = {
    findSenderAndPeers: vi.fn(async () => ({ name: 'Camila', peers: opts.peers ?? ['u2', 'u3'] })),
    listGroupMembers: vi.fn(async () => opts.peers ?? ['u2', 'u3']),
    listRecipients: vi.fn(async (ids: readonly string[]) =>
      (opts.recipients ?? [
        { userId: 'u2', locale: 'es' as const, tokens: ['tok-u2'] },
        { userId: 'u3', locale: 'pt-BR' as const, tokens: ['tok-u3'] },
      ]).filter((r) => ids.includes(r.userId)),
    ),
    deleteTokens: vi.fn(async () => undefined),
  };
  const sender = {
    enabled: opts.enabled ?? true,
    send: vi.fn(async (tokens: readonly string[], message: { title: string }) => {
      sent.push({ tokens, title: message.title });
      return { invalidTokens: opts.invalidTokens ?? [] };
    }),
  };
  const redis = {
    setIfAbsent: vi.fn(async (key: string) => !(opts.throttled ?? new Set()).has(key)),
  };
  const service = new PushService(
    repository as unknown as PushRepository,
    sender as unknown as PushSender,
    redis as unknown as RedisService,
  );
  return { service, repository, sender, redis, sent };
}

describe('push messages', () => {
  it('se escriben en el idioma del destinatario', () => {
    expect(challengeMessage('es', { name: 'Ana', topic: 'viajes' }).title).toBe('Ana practicó hoy');
    expect(challengeMessage('pt-BR', { name: 'Ana', topic: 'viagens' }).title).toBe('Ana praticou hoje');
    expect(weeklySummaryMessage('pt-BR').data).toEqual({ type: 'weekly_summary', route: '/group' });
  });
});

describe('PushService', () => {
  it('avisa del desafío a cada compañero, en su idioma', async () => {
    const { service, sent } = setup();
    await service.notifyChallenge('u1', 'viajes');
    expect(sent).toEqual([
      { tokens: ['tok-u2'], title: 'Camila practicó hoy' },
      { tokens: ['tok-u3'], title: 'Camila praticou hoje' },
    ]);
  });

  it('como mucho un aviso de desafío por destinatario por día', async () => {
    const { service, sent } = setup({ throttled: new Set(['push:challenge:u2']) });
    await service.notifyChallenge('u1', 'viajes');
    expect(sent.map((s) => s.tokens)).toEqual([['tok-u3']]);
  });

  it('sin cuenta de servicio de Firebase no hace nada', async () => {
    const { service, repository, sent } = setup({ enabled: false });
    await service.notifyChallenge('u1', 'viajes');
    await service.notifyWeeklySummary('g1');
    expect(sent).toEqual([]);
    expect(repository.findSenderAndPeers).not.toHaveBeenCalled();
  });

  it('borra los tokens que FCM rechazó', async () => {
    const { service, repository } = setup({ invalidTokens: ['tok-muerto'] });
    await service.notifyWeeklySummary('g1');
    expect(repository.deleteTokens).toHaveBeenCalledWith(['tok-muerto', 'tok-muerto']);
  });

  it('un fallo al enviar nunca se propaga', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { service, sender } = setup();
    sender.send.mockRejectedValue(new Error('fcm caído'));
    await expect(service.notifyWeeklySummary('g1')).resolves.toBeUndefined();
    warn.mockRestore();
  });
});
