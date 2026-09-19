import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import type { Env } from '../config/env.js';
import type { PushMessage } from './push.messages.js';

/** Resultado de un envío: los tokens que FCM dio por muertos. */
export interface PushSendResult {
  readonly invalidTokens: readonly string[];
}

/**
 * Envoltorio de Firebase Admin (FCM). Sin `FIREBASE_SERVICE_ACCOUNT` queda
 * desactivado: `send` no hace nada y la API funciona igual.
 */
@Injectable()
export class PushSender {
  private readonly logger = new Logger(PushSender.name);
  private readonly app: App | null;

  constructor(configService: ConfigService<Env, true>) {
    const encoded = configService.get('FIREBASE_SERVICE_ACCOUNT', { infer: true });
    this.app = encoded ? this.initApp(encoded) : null;
    if (this.app === null) {
      this.logger.log('Push desactivado: falta FIREBASE_SERVICE_ACCOUNT.');
    }
  }

  get enabled(): boolean {
    return this.app !== null;
  }

  async send(tokens: readonly string[], message: PushMessage): Promise<PushSendResult> {
    if (this.app === null || tokens.length === 0) return { invalidTokens: [] };
    const response = await getMessaging(this.app).sendEachForMulticast({
      tokens: [...tokens],
      notification: { title: message.title, body: message.body },
      data: { ...message.data },
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    });
    const invalidTokens = response.responses.flatMap((r, i) =>
      !r.success &&
      (r.error?.code === 'messaging/registration-token-not-registered' ||
        r.error?.code === 'messaging/invalid-registration-token')
        ? [tokens[i]!]
        : [],
    );
    return { invalidTokens };
  }

  private initApp(encoded: string): App | null {
    try {
      const serviceAccount = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
      return getApps().find((a) => a.name === 'push') ??
        initializeApp({ credential: cert(serviceAccount) }, 'push');
    } catch (error) {
      this.logger.error(`FIREBASE_SERVICE_ACCOUNT inválida: ${(error as Error).message}`);
      return null;
    }
  }
}
