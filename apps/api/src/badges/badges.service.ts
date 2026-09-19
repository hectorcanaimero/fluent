import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { BadgesRepository } from './badges.repository.js';
import { toBadgeDtos } from './badges.mapper.js';
import type { BadgeDto } from './badges.types.js';

@Injectable()
export class BadgesService {
  private readonly logger = new Logger(BadgesService.name);
  private readonly insforgeUrl: string;

  constructor(
    private readonly repository: BadgesRepository,
    configService: ConfigService<Env, true>,
  ) {
    this.insforgeUrl = configService.get('INSFORGE_URL', { infer: true });
  }

  async getBadges(userId: string): Promise<{ badges: BadgeDto[] }> {
    // Primero se otorga lo pendiente (umbral bajado, insignia nueva en el
    // catálogo): sin esto una insignia podía verse bloqueada con el progreso
    // al 100 % hasta la próxima sesión. Es idempotente; si falla, se muestra
    // lo que haya.
    try {
      await this.repository.awardPending(userId);
    } catch (error) {
      this.logger.warn(`No se pudieron otorgar insignias pendientes: ${(error as Error).message}`);
    }
    const [catalog, earned, profile] = await Promise.all([
      this.repository.listCatalog(),
      this.repository.listEarned(userId),
      this.repository.findProgressSource(userId),
    ]);
    return { badges: toBadgeDtos(catalog, earned, profile, this.insforgeUrl) };
  }
}
