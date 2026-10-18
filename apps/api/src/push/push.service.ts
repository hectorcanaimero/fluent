import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service.js';
import { GroupsRepository } from '../groups/groups.repository.js';
import {
  challengeMessage,
  groupSessionMessage,
  weeklySummaryMessage,
  interviewReadyMessage,
  interviewPrepFailedMessage,
  interviewFeedbackReadyMessage,
  studyReminderMessage,
  type PushMessage,
} from './push.messages.js';
import { PushRepository, type PushPlatform } from './push.repository.js';
import { PushSender } from './push.sender.js';
import type { Locale } from '../db/schema.js';

/** Un aviso de desafío por destinatario y por día: más que eso es spam. */
const CHALLENGE_THROTTLE_SEC = 24 * 60 * 60;

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private readonly repository: PushRepository,
    private readonly sender: PushSender,
    private readonly redis: RedisService,
    private readonly groupsRepository: GroupsRepository,
  ) {}

  registerToken(userId: string, token: string, platform: PushPlatform): Promise<void> {
    return this.repository.upsertToken(userId, token, platform);
  }

  unregisterToken(userId: string, token: string): Promise<void> {
    return this.repository.deleteToken(userId, token);
  }

  /**
   * Un miembro terminó una sesión válida: se avisa al resto del grupo. Nunca
   * lanza (se llama sin esperar desde el cierre de sesión).
   */
  async notifyChallenge(fromUserId: string, topic: string): Promise<void> {
    await this.safely('challenge', async () => {
      if (!this.sender.enabled) return;
      const sender = await this.repository.findSenderAndPeers(fromUserId);
      if (sender === null) return;
      const { name, peers } = sender;
      const allowed: string[] = [];
      for (const peer of peers) {
        if (await this.redis.setIfAbsent(`push:challenge:${peer}`, '1', CHALLENGE_THROTTLE_SEC)) {
          allowed.push(peer);
        }
      }
      await this.sendTo(allowed, (locale) => challengeMessage(locale, { name, topic }));
    });
  }

  /** Salió el resumen semanal del grupo: se avisa a todos sus miembros. */
  async notifyWeeklySummary(groupId: string): Promise<void> {
    await this.safely('weekly_summary', async () => {
      if (!this.sender.enabled) return;
      const members = await this.repository.listGroupMembers(groupId);
      await this.sendTo(members, weeklySummaryMessage);
    });
  }

  /**
   * Alguien abrió una sala grupal: se avisa al resto del grupo, menos a quien
   * la abrió. Sin throttle (FR-4 ya limita a una sala activa por grupo).
   */
  async notifyGroupSessionStarted(params: {
    sessionId: string;
    groupId: string;
    initiatorId: string;
    initiatorName: string;
    topic: string;
  }): Promise<void> {
    await this.safely('group_session', async () => {
      if (!this.sender.enabled) return;
      const members = await this.groupsRepository.listMembers(params.groupId);
      const recipients = members
        .map((m) => m.user_id)
        .filter((userId) => userId !== params.initiatorId);
      await this.sendTo(recipients, (locale) =>
        groupSessionMessage(locale, {
          sessionId: params.sessionId,
          initiatorName: params.initiatorName,
          topic: params.topic,
        }),
      );
    });
  }

  /** La entrevista está lista para empezar. */
  async notifyInterviewReady(userId: string, interviewId: string, role: string, company: string): Promise<void> {
    await this.safely('interview_ready', async () => {
      if (!this.sender.enabled) return;
      await this.sendTo([userId], (locale) => interviewReadyMessage(locale, { interviewId, role, company }));
    });
  }

  /** La preparación de la entrevista falló. */
  async notifyInterviewPrepFailed(userId: string, interviewId: string, company: string): Promise<void> {
    await this.safely('interview_prep_failed', async () => {
      if (!this.sender.enabled) return;
      await this.sendTo([userId], (locale) => interviewPrepFailedMessage(locale, { interviewId, company }));
    });
  }

  /** El parecer de la entrevista está listo. */
  async notifyInterviewFeedbackReady(userId: string, interviewId: string, company: string): Promise<void> {
    await this.safely('interview_feedback_ready', async () => {
      if (!this.sender.enabled) return;
      await this.sendTo([userId], (locale) => interviewFeedbackReadyMessage(locale, { interviewId, company }));
    });
  }

  /** Recordatorio para continuar el ciclo de estudio. */
  async notifyStudyReminder(userId: string, interviewId: string, n: number, total: number, title: string): Promise<void> {
    await this.safely('study_reminder', async () => {
      if (!this.sender.enabled) return;
      await this.sendTo([userId], (locale) => studyReminderMessage(locale, { interviewId, n, total, title }));
    });
  }

  private async sendTo(
    userIds: readonly string[],
    build: (locale: Locale) => PushMessage,
  ): Promise<void> {
    const recipients = await this.repository.listRecipients(userIds);
    const invalid: string[] = [];
    for (const recipient of recipients) {
      const result = await this.sender.send(recipient.tokens, build(recipient.locale));
      invalid.push(...result.invalidTokens);
    }
    await this.repository.deleteTokens(invalid);
  }

  private async safely(kind: string, work: () => Promise<void>): Promise<void> {
    try {
      await work();
    } catch (error) {
      this.logger.warn(`No se pudo enviar el push '${kind}': ${(error as Error).message}`);
    }
  }
}
