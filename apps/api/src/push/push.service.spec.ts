import { Logger } from '@nestjs/common';
import type { RedisService } from '../redis/redis.service.js';
import type { GroupsRepository, GroupMemberRow } from '../groups/groups.repository.js';
import {
  challengeMessage,
  groupSessionMessage,
  weeklySummaryMessage,
  interviewReadyMessage,
  interviewPrepFailedMessage,
  interviewFeedbackReadyMessage,
  studyReminderMessage,
} from './push.messages.js';
import type { PushRepository, PushRecipient } from './push.repository.js';
import type { PushSender } from './push.sender.js';
import { PushService } from './push.service.js';

function member(userId: string): GroupMemberRow {
  return {
    user_id: userId,
    display_name: userId,
    level: 'A2',
    xp: 0,
    streak: 0,
    last_session_day: null,
    avatar_url: null,
  };
}

function setup(opts: {
  enabled?: boolean;
  peers?: string[];
  members?: string[];
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
  const groupsRepository = {
    listMembers: vi.fn(async () => (opts.members ?? ['u1', 'u2', 'u3']).map(member)),
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
    groupsRepository as unknown as GroupsRepository,
  );
  return { service, repository, groupsRepository, sender, redis, sent };
}

describe('push messages', () => {
  it('se escriben en el idioma del destinatario', () => {
    expect(challengeMessage('es', { name: 'Ana', topic: 'viajes' }).title).toBe('Ana practicó hoy');
    expect(challengeMessage('pt-BR', { name: 'Ana', topic: 'viagens' }).title).toBe('Ana praticou hoje');
    expect(weeklySummaryMessage('pt-BR').data).toEqual({ type: 'weekly_summary', route: '/group' });
  });

  it('el aviso de sala grupal lleva la ruta y el idioma del destinatario', () => {
    const es = groupSessionMessage('es', { sessionId: 's1', initiatorName: 'Camila', topic: 'viajes' });
    expect(es.title).toBe('Sesión grupal');
    expect(es.body).toBe('Camila abrió una sesión grupal sobre viajes');
    expect(es.data).toEqual({ type: 'group_session', route: '/group-session/s1' });

    const pt = groupSessionMessage('pt-BR', { sessionId: 's1', initiatorName: 'Camila', topic: 'viagens' });
    expect(pt.title).toBe('Sessão em grupo');
    expect(pt.body).toBe('Camila abriu uma sessão em grupo sobre viagens');
    expect(pt.data).toEqual({ type: 'group_session', route: '/group-session/s1' });
  });

  it('interview_ready se escribe en el idioma del destinatario', () => {
    const es = interviewReadyMessage('es', { role: 'Senior Engineer', company: 'Google' });
    expect(es.title).toBe('Tu entrevista está lista');
    expect(es.body).toBe('Tu entrevista para Senior Engineer en Google está lista. ¿Empezamos?');
    expect(es.data).toEqual({ type: 'interview_ready', route: '/interviews/:id' });

    const pt = interviewReadyMessage('pt-BR', { role: 'Senior Engineer', company: 'Google' });
    expect(pt.title).toBe('Entrevista pronta');
    expect(pt.body).toBe('Sua entrevista para Senior Engineer na Google está pronta. Vamos começar?');
    expect(pt.data).toEqual({ type: 'interview_ready', route: '/interviews/:id' });
  });

  it('interview_prep_failed se escribe en el idioma del destinatario', () => {
    const es = interviewPrepFailedMessage('es', { company: 'Google' });
    expect(es.title).toBe('No pudimos preparar tu entrevista');
    expect(es.body).toBe('No pudimos preparar tu entrevista para Google. Toca para intentarlo de nuevo.');
    expect(es.data).toEqual({ type: 'interview_prep_failed', route: '/interviews/:id' });

    const pt = interviewPrepFailedMessage('pt-BR', { company: 'Google' });
    expect(pt.title).toBe('Erro na preparação');
    expect(pt.body).toBe('Não conseguimos preparar sua entrevista para Google. Toca para tentar novamente.');
    expect(pt.data).toEqual({ type: 'interview_prep_failed', route: '/interviews/:id' });
  });

  it('interview_feedback_ready se escribe en el idioma del destinatario', () => {
    const es = interviewFeedbackReadyMessage('es', { company: 'Google' });
    expect(es.title).toBe('Tu parecer está listo');
    expect(es.body).toBe('Tu parecer de Google está listo.');
    expect(es.data).toEqual({ type: 'interview_feedback_ready', route: '/interviews/:id/feedback' });

    const pt = interviewFeedbackReadyMessage('pt-BR', { company: 'Google' });
    expect(pt.title).toBe('Parecer pronto');
    expect(pt.body).toBe('Seu parecer de Google está pronto.');
    expect(pt.data).toEqual({ type: 'interview_feedback_ready', route: '/interviews/:id/feedback' });
  });

  it('study_reminder se escribe en el idioma del destinatario', () => {
    const es = studyReminderMessage('es', { n: 2, title: 'Vocabulario técnico' });
    expect(es.title).toBe('Toca continuar');
    expect(es.body).toBe('Te toca la sesión 2 de 5: Vocabulario técnico.');
    expect(es.data).toEqual({ type: 'study_reminder', route: '/interviews/:id/cycle' });

    const pt = studyReminderMessage('pt-BR', { n: 2, title: 'Vocabulário técnico' });
    expect(pt.title).toBe('Sessão de estudo');
    expect(pt.body).toBe('Te toca a sessão 2 de 5: Vocabulário técnico.');
    expect(pt.data).toEqual({ type: 'study_reminder', route: '/interviews/:id/cycle' });
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
    const { service, repository, groupsRepository, sent } = setup({ enabled: false });
    await service.notifyChallenge('u1', 'viajes');
    await service.notifyWeeklySummary('g1');
    await service.notifyGroupSessionStarted({
      sessionId: 's1',
      groupId: 'g1',
      initiatorId: 'u1',
      initiatorName: 'Camila',
      topic: 'viajes',
    });
    expect(sent).toEqual([]);
    expect(repository.findSenderAndPeers).not.toHaveBeenCalled();
    expect(groupsRepository.listMembers).not.toHaveBeenCalled();
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

  it('avisa de la sala grupal a todo el grupo menos a quien la abrió', async () => {
    const { service, groupsRepository, sent } = setup({ members: ['u1', 'u2', 'u3'] });
    await service.notifyGroupSessionStarted({
      sessionId: 's1',
      groupId: 'g1',
      initiatorId: 'u1',
      initiatorName: 'Camila',
      topic: 'viajes',
    });
    expect(groupsRepository.listMembers).toHaveBeenCalledWith('g1');
    expect(sent).toEqual([
      { tokens: ['tok-u2'], title: 'Sesión grupal' },
      { tokens: ['tok-u3'], title: 'Sessão em grupo' },
    ]);
  });

  it('la ruta del aviso de sala grupal lleva el sessionId', async () => {
    const { service, sender } = setup({ members: ['u1', 'u2'] });
    await service.notifyGroupSessionStarted({
      sessionId: 's42',
      groupId: 'g1',
      initiatorId: 'u1',
      initiatorName: 'Camila',
      topic: 'viajes',
    });
    expect(sender.send).toHaveBeenCalledWith(
      ['tok-u2'],
      expect.objectContaining({ data: { type: 'group_session', route: '/group-session/s42' } }),
    );
  });

  it('un fallo al listar los miembros del grupo nunca se propaga', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { service, groupsRepository } = setup();
    groupsRepository.listMembers.mockRejectedValue(new Error('db caída'));
    await expect(
      service.notifyGroupSessionStarted({
        sessionId: 's1',
        groupId: 'g1',
        initiatorId: 'u1',
        initiatorName: 'Camila',
        topic: 'viajes',
      }),
    ).resolves.toBeUndefined();
    warn.mockRestore();
  });

  it('avisa que la entrevista está lista en el idioma del usuario', async () => {
    const { service, sent } = setup({
      recipients: [
        { userId: 'u1', locale: 'es' as const, tokens: ['tok-u1'] },
        { userId: 'u2', locale: 'pt-BR' as const, tokens: ['tok-u2'] },
      ],
    });
    await service.notifyInterviewReady('u1', 'i1', 'Senior Engineer', 'Google');
    await service.notifyInterviewReady('u2', 'i2', 'Engenheira Sênior', 'Google');
    expect(sent).toEqual([
      { tokens: ['tok-u1'], title: 'Tu entrevista está lista' },
      { tokens: ['tok-u2'], title: 'Entrevista pronta' },
    ]);
  });

  it('avisa que la preparación de la entrevista falló en el idioma del usuario', async () => {
    const { service, sent } = setup({
      recipients: [
        { userId: 'u1', locale: 'es' as const, tokens: ['tok-u1'] },
        { userId: 'u2', locale: 'pt-BR' as const, tokens: ['tok-u2'] },
      ],
    });
    await service.notifyInterviewPrepFailed('u1', 'i1', 'Google');
    await service.notifyInterviewPrepFailed('u2', 'i2', 'Google');
    expect(sent).toEqual([
      { tokens: ['tok-u1'], title: 'No pudimos preparar tu entrevista' },
      { tokens: ['tok-u2'], title: 'Erro na preparação' },
    ]);
  });

  it('avisa que el parecer de la entrevista está listo en el idioma del usuario', async () => {
    const { service, sent } = setup({
      recipients: [
        { userId: 'u1', locale: 'es' as const, tokens: ['tok-u1'] },
        { userId: 'u2', locale: 'pt-BR' as const, tokens: ['tok-u2'] },
      ],
    });
    await service.notifyInterviewFeedbackReady('u1', 'i1', 'Google');
    await service.notifyInterviewFeedbackReady('u2', 'i2', 'Google');
    expect(sent).toEqual([
      { tokens: ['tok-u1'], title: 'Tu parecer está listo' },
      { tokens: ['tok-u2'], title: 'Parecer pronto' },
    ]);
  });

  it('avisa el recordatorio de sesión de estudio en el idioma del usuario', async () => {
    const { service, sent } = setup({
      recipients: [
        { userId: 'u1', locale: 'es' as const, tokens: ['tok-u1'] },
        { userId: 'u2', locale: 'pt-BR' as const, tokens: ['tok-u2'] },
      ],
    });
    await service.notifyStudyReminder('u1', 'i1', 2, 'Vocabulario técnico');
    await service.notifyStudyReminder('u2', 'i2', 2, 'Vocabulário técnico');
    expect(sent).toEqual([
      { tokens: ['tok-u1'], title: 'Toca continuar' },
      { tokens: ['tok-u2'], title: 'Sessão de estudo' },
    ]);
  });

  it('un fallo al enviar notificaciones de entrevista nunca se propaga', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { service, sender } = setup();
    sender.send.mockRejectedValue(new Error('fcm caído'));
    await expect(service.notifyInterviewReady('u1', 'i1', 'Engineer', 'Google')).resolves.toBeUndefined();
    await expect(
      service.notifyInterviewPrepFailed('u1', 'i1', 'Google'),
    ).resolves.toBeUndefined();
    await expect(
      service.notifyInterviewFeedbackReady('u1', 'i1', 'Google'),
    ).resolves.toBeUndefined();
    await expect(service.notifyStudyReminder('u1', 'i1', 2, 'Title')).resolves.toBeUndefined();
    warn.mockRestore();
  });

  it('los avisos de entrevista llevan la ruta correcta', async () => {
    const { service, sender } = setup({
      recipients: [{ userId: 'u1', locale: 'es' as const, tokens: ['tok-u1'] }],
    });
    await service.notifyInterviewReady('u1', 'i1', 'Engineer', 'Google');
    expect(sender.send).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ data: { type: 'interview_ready', route: '/interviews/:id' } }),
    );
    await service.notifyInterviewPrepFailed('u1', 'i1', 'Google');
    expect(sender.send).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ data: { type: 'interview_prep_failed', route: '/interviews/:id' } }),
    );
    await service.notifyInterviewFeedbackReady('u1', 'i1', 'Google');
    expect(sender.send).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ data: { type: 'interview_feedback_ready', route: '/interviews/:id/feedback' } }),
    );
    await service.notifyStudyReminder('u1', 'i1', 2, 'Title');
    expect(sender.send).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ data: { type: 'study_reminder', route: '/interviews/:id/cycle' } }),
    );
  });
});
