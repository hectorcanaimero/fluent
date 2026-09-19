import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service.js';
import { challengeMessage, weeklySummaryMessage, type PushMessage } from './push.messages.js';
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
