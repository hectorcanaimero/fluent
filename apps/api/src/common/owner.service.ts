import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import type { Group } from '../db/schema.js';

/**
 * Servicio reutilizable para verificar si un usuario es owner.
 *
 * Owner es:
 * - El `owner_id` del grupo (SPEC-01 §2.2), O
 * - El `OWNER_USER_ID` del sistema (SPEC-02 §4.1, SPEC-02 §4.6, docs/specs/pendientes/PR-02.md PEND-11).
 *
 * Se usa en `GroupsService` (RFC-8.1) y `AdminService` (RFC-8.2).
 */
@Injectable()
export class OwnerService {
  private readonly ownerUserId: string;

  constructor(private readonly configService: ConfigService<Env, true>) {
    this.ownerUserId = configService.get('OWNER_USER_ID', { infer: true });
  }

  /**
   * Devuelve `true` si el usuario es owner (del grupo o del sistema).
   */
  isOwner(userId: string, group: Group): boolean {
    return userId === group.owner_id || userId === this.ownerUserId;
  }

  /**
   * Devuelve `true` si el usuario es el owner del sistema.
   */
  isSystemOwner(userId: string): boolean {
    return userId === this.ownerUserId;
  }
}
