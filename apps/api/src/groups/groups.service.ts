import { Injectable } from '@nestjs/common';
import { ApiException } from '../common/api-error.js';
import { I18nService } from '../i18n/i18n.service.js';
import { OwnerService } from '../common/owner.service.js';
import { toGroupDto, toGroupMemberDto } from '../profiles/profile.mapper.js';
import { ProfilesRepository } from '../profiles/profiles.repository.js';
import type { GroupDto, GroupMemberDto } from '../profiles/profiles.types.js';
import { GroupsRepository, type CreatedInvitation } from './groups.repository.js';
import type { Group } from '../db/schema.js';

export const DEFAULT_INVITATIONS_COUNT = 1;

/**
 * `GroupsModule` (SPEC-02 §4.1): `POST /invitations/redeem`,
 * `POST /admin/invitations`, `POST /groups/invitations`, `GET /group`.
 */
@Injectable()
export class GroupsService {
  constructor(
    private readonly profilesRepository: ProfilesRepository,
    private readonly groupsRepository: GroupsRepository,
    private readonly i18n: I18nService,
    private readonly ownerService: OwnerService,
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
        // Un código siempre lleva a un grupo de amigos, no al grupo por defecto.
        isDefault: false,
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

  /**
   * `POST /groups/invitations` (MEJ-41): **cualquier** miembro del grupo
   * genera un código para invitar a un amigo, no solo el owner (que sigue
   * teniendo `POST /admin/invitations` para crear varios de una vez).
   *
   * Sin grupo → `422 GROUP_REQUIRED` (y no el `409 NOT_ONBOARDED` de los
   * otros endpoints de grupo): el perfil está completo, lo que falta es
   * canjear una invitación, y la app lleva a pantallas distintas en cada
   * caso. Sin tope de invitaciones: cada código es de un solo uso y caduca
   * solo, y un tope de cinco se agotaba sin haber compartido ninguno.
   */
  async createInvitation(
    userId: string,
    acceptLanguageHeader?: string,
  ): Promise<CreatedInvitation> {
    const { profile, group } = await this.requireOwnGroup(
      userId,
      acceptLanguageHeader,
      'GROUP_REQUIRED',
    );

    return this.groupsRepository.createInvitation(group.id, profile.user_id);
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

  /**
   * Perfil + su grupo. Sin grupo lanza `missingGroupCode`: `NOT_ONBOARDED`
   * (409) en los endpoints de siempre y `GROUP_REQUIRED` (422) en los que
   * añadió MEJ-33/MEJ-41.
   */
  private async requireOwnGroup(
    userId: string,
    acceptLanguageHeader?: string,
    missingGroupCode: 'NOT_ONBOARDED' | 'GROUP_REQUIRED' = 'NOT_ONBOARDED',
  ) {
    const profile = await this.profilesRepository.ensureProfile(userId);
    const locale = this.i18n.resolveLocale(profile.locale, acceptLanguageHeader);
    const missingGroup = () =>
      ApiException.of(missingGroupCode, this.i18n.translate(missingGroupCode, locale));

    if (!profile.group_id) {
      throw missingGroup();
    }

    const group = await this.groupsRepository.findById(profile.group_id);
    if (!group) {
      throw missingGroup();
    }

    return { profile, group, locale };
  }

  private isOwner(userId: string, group: Group): boolean {
    return this.ownerService.isOwner(userId, group);
  }
}
