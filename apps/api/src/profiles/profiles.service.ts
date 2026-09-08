import { Injectable } from '@nestjs/common';
import { INTERESTS } from '../content/index.js';
import { CredentialsRepository } from '../credentials/credentials.repository.js';
import { GroupsRepository } from '../groups/groups.repository.js';
import { PendingActionsService } from './pending-actions.service.js';
import { toGroupDto, toModelPreferenceDto, toProfileDto } from './profile.mapper.js';
import { ProfilesRepository } from './profiles.repository.js';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';
import type { MeDto, ProfileDto } from './profiles.types.js';

/** Catálogo de ids de interés, calculado una sola vez (SPEC-02 §4.1). */
const INTERESTS_CATALOG_IDS = INTERESTS.map((interest) => interest.id);

/**
 * `ProfilesModule` (SPEC-02 §4.1): `GET /me`, `PUT /me/profile`, `DELETE /me`.
 */
@Injectable()
export class ProfilesService {
  constructor(
    private readonly profilesRepository: ProfilesRepository,
    private readonly groupsRepository: GroupsRepository,
    // `provider_credentials` la lee su propio repositorio desde PR-02/T4
    // (docs/specs/pendientes/PR-02.md PEND-15).
    private readonly credentialsRepository: CredentialsRepository,
    // `pendingActions` (SPEC-02 §4.1): hoy solo el aviso que deja el job
    // `weekly-summary` de PR-05 en Redis (PEND-76).
    private readonly pendingActions: PendingActionsService,
  ) {}

  async getMe(userId: string): Promise<MeDto> {
    const profile = await this.profilesRepository.ensureProfile(userId);

    const [group, providers, modelPreference, activeSessionId, pendingActions] =
      await Promise.all([
        profile.group_id ? this.groupsRepository.findById(profile.group_id) : Promise.resolve(null),
        this.credentialsRepository.listStatuses(userId),
        this.profilesRepository.getModelPreference(userId),
        this.profilesRepository.getActiveSessionId(userId),
        this.pendingActions.listFor(userId),
      ]);

    return {
      profile: toProfileDto(profile),
      group: group ? toGroupDto(group) : null,
      providers,
      modelPreference: toModelPreferenceDto(modelPreference),
      onboarded: profile.onboarded_at !== null,
      activeSessionId,
      interestsCatalog: INTERESTS_CATALOG_IDS,
      pendingActions,
    };
  }

  /**
   * `onboarded` (docs/specs/pendientes/PR-02.md): `profiles.onboarded_at` se
   * rellena aquí, la primera vez que el perfil queda completo (los cuatro
   * campos del DTO, ya validados) **y** el usuario ya tiene grupo. Una vez
   * puesto, no se vuelve a tocar (no hay forma de "des-onboardearse").
   */
  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<ProfileDto> {
    const current = await this.profilesRepository.ensureProfile(userId);

    const shouldMarkOnboarded = current.group_id !== null && current.onboarded_at === null;

    const updated = await this.profilesRepository.update(userId, {
      display_name: dto.displayName,
      level: dto.level,
      interests: dto.interests,
      timezone: dto.timezone,
      locale: dto.locale,
      ...(shouldMarkOnboarded ? { onboarded_at: new Date().toISOString() } : {}),
    });

    return toProfileDto(updated);
  }

  async deleteAccountData(userId: string): Promise<void> {
    await this.profilesRepository.purgeAppData(userId);
  }
}
