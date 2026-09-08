import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiException } from '../common/api-error.js';
import type { Env } from '../config/env.js';
import { I18nService } from '../i18n/i18n.service.js';
import { toGroupDto, toGroupMemberDto } from '../profiles/profile.mapper.js';
import { ProfilesRepository } from '../profiles/profiles.repository.js';
import type { GroupDto, GroupMemberDto } from '../profiles/profiles.types.js';
import { GroupsRepository } from './groups.repository.js';
import type { Group } from '../db/schema.js';

export const DEFAULT_INVITATIONS_COUNT = 1;

/**
 * `GroupsModule` (SPEC-02 §4.1): `POST /invitations/redeem`,
 * `POST /admin/invitations`, `GET /group`.
 */
@Injectable()
export class GroupsService {
  constructor(
    private readonly profilesRepository: ProfilesRepository,
    private readonly groupsRepository: GroupsRepository,
    private readonly i18n: I18nService,
    private readonly configService: ConfigService<Env, true>,
  ) {}

  /** `POST /invitations/redeem` (RPC `redeem_invitation`, SPEC-01 §5). */
  async redeemInvitation(
    userId: string,
    code: string,
    acceptLanguageHeader?: string,
  ): Promise<{ group: GroupDto }> {
    // El perfil debe existir antes de llamar a la RPC (PROFILE_NOT_FOUND si
    // no); ver docs/specs/pendientes/PR-02.md.
    const profile = await this.profilesRepository.ensureProfile(userId);
    const locale = this.i18n.resolveLocale(profile.locale, acceptLanguageHeader);

    const result = await this.groupsRepository.redeemInvitation(userId, code, (apiCode) =>
      this.i18n.translate(apiCode, locale),
    );

    return {
      group: {
        id: result.group_id,
        name: result.name,
        groupStreak: result.group_streak,
      },
    };
  }

  /**
   * `POST /admin/invitations` (RF-8.1). SPEC-02 §4.1 dice «solo `owner_id`
   * del grupo» y el alcance de T2 dice «solo `OWNER_USER_ID`»: se acepta
   * cualquiera de los dos (docs/specs/pendientes/PR-02.md). Sin grupo →
   * `409 NOT_ONBOARDED`; con grupo pero sin ser owner → `403 FORBIDDEN`.
   */
  async createInvitations(
    userId: string,
    count: number,
    acceptLanguageHeader?: string,
  ): Promise<{ codes: string[] }> {
    const { profile, group, locale } = await this.requireOwnGroup(userId, acceptLanguageHeader);

    if (!this.isOwner(userId, group)) {
      throw ApiException.forbidden(this.i18n.translate('FORBIDDEN', locale));
    }

    const codes = await this.groupsRepository.createInvitations(group.id, profile.user_id, count);
    return { codes };
  }

  /** `GET /group` (RF-6.5): grupo y miembros, solo las columnas permitidas. */
  async getGroup(
    userId: string,
    acceptLanguageHeader?: string,
  ): Promise<{ group: GroupDto; members: GroupMemberDto[] }> {
    const { group } = await this.requireOwnGroup(userId, acceptLanguageHeader);
    const members = await this.groupsRepository.listMembers(group.id);

    return {
      group: toGroupDto(group),
      members: members.map(toGroupMemberDto),
    };
  }

  /** Perfil + su grupo, o `409 NOT_ONBOARDED` si no tiene uno todavía. */
  private async requireOwnGroup(userId: string, acceptLanguageHeader?: string) {
    const profile = await this.profilesRepository.ensureProfile(userId);
    const locale = this.i18n.resolveLocale(profile.locale, acceptLanguageHeader);

    if (!profile.group_id) {
      throw ApiException.of('NOT_ONBOARDED', this.i18n.translate('NOT_ONBOARDED', locale));
    }

    const group = await this.groupsRepository.findById(profile.group_id);
    if (!group) {
      throw ApiException.of('NOT_ONBOARDED', this.i18n.translate('NOT_ONBOARDED', locale));
    }

    return { profile, group, locale };
  }

  private isOwner(userId: string, group: Group): boolean {
    const ownerUserId = this.configService.get('OWNER_USER_ID', { infer: true });
    return userId === group.owner_id || userId === ownerUserId;
  }
}
