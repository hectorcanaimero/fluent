import { Injectable } from '@nestjs/common';
import { INTERESTS } from '../content/index.js';
import { CredentialsRepository } from '../credentials/credentials.repository.js';
import { GroupsRepository } from '../groups/groups.repository.js';
import { SessionsQueryRepository } from '../sessions-query/sessions-query.repository.js';
import { startOfUserDay } from '../sessions/user-day.js';
import { PendingActionsService } from './pending-actions.service.js';
import { toGroupDto, toModelPreferenceDto, toProfileDto } from './profile.mapper.js';
import { ProfilesRepository } from './profiles.repository.js';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';
import { XP_PROFILE_COMPLETED } from '../config/product.js';
import type { Profile } from '../db/schema.js';
import type {
  MeDto,
  ProviderInfoDto,
  UpdateProfileResultDto,
} from './profiles.types.js';

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
    // `sessionsToday`: el mismo repositorio que usan progreso y social.
    private readonly sessionsQuery: SessionsQueryRepository,
  ) {}

  async getMe(userId: string): Promise<MeDto> {
    const profile = await this.profilesRepository.ensureProfile(userId);

    // El día arranca en la zona del usuario, no en UTC: si no, a alguien en
    // Buenos Aires se le reiniciaría el contador a las 21:00 de su tarde.
    const since = startOfUserDay(profile.timezone).toISOString();

    const [
      group,
      providers,
      modelPreference,
      activeSessionId,
      pendingActions,
      sessionsToday,
    ] = await Promise.all([
      profile.group_id ? this.groupsRepository.findById(profile.group_id) : Promise.resolve(null),
      this.credentialsRepository.listStatuses(userId),
      this.profilesRepository.getModelPreference(userId),
      this.profilesRepository.getActiveSessionId(userId),
      this.pendingActions.listFor(userId),
      this.sessionsQuery.countValidSessionsSince(userId, since),
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
      sessionsToday,
      courtesySessionAvailable: await this.isCourtesyAvailable(profile, providers),
    };
  }

  /**
   * `onboarded` (docs/specs/pendientes/PR-02.md): `profiles.onboarded_at` se
   * rellena aquí, la primera vez que el perfil queda completo (los cuatro
   * campos del DTO, ya validados) **y** el usuario ya tiene grupo. Una vez
   * puesto, no se vuelve a tocar (no hay forma de "des-onboardearse").
   */
  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UpdateProfileResultDto> {
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

    // MEJ-14: 20 XP la primera vez que el perfil queda completo, para que la
    // barra de nivel no arranque en cero. La idempotencia la garantiza la
    // base (índice único parcial), así que aquí basta con pedirlo cuando toca
    // y creerse lo que devuelva.
    const xpAwarded = shouldMarkOnboarded
      ? await this.profilesRepository.awardProfileCompleted(userId, XP_PROFILE_COMPLETED)
      : 0;

    return {
      // El XP recién concedido no está en la fila que devolvió el UPDATE,
      // porque lo suma la RPC después; se añade aquí para no obligar a la app
      // a recargar `/me` solo para ver su propia recompensa.
      ...toProfileDto(updated),
      xp: toProfileDto(updated).xp + xpAwarded,
      xpAwarded,
    };
  }

  /**
   * ¿Le queda al usuario la sesión de cortesía de MAL-24?
   *
   * Se comprueba también que el owner tenga credencial activa: ofrecer una
   * cortesía que va a fallar al abrir la sesión es peor que no ofrecerla.
   * Usa `listStatuses`, que no descifra ninguna key.
   */
  private async isCourtesyAvailable(
    profile: Profile,
    providers: ProviderInfoDto[],
  ): Promise<boolean> {
    if (profile.courtesy_session_used_at !== null || profile.group_id === null) {
      return false;
    }
    if (providers.some((provider) => provider.status === 'active')) {
      return false;
    }

    const group = await this.groupsRepository.findById(profile.group_id);
    const ownerId = group?.owner_id ?? null;
    if (ownerId === null || ownerId === profile.user_id) {
      return false;
    }

    const ownerProviders = await this.credentialsRepository.listStatuses(ownerId);
    return ownerProviders.some((provider) => provider.status === 'active');
  }

  async deleteAccountData(userId: string): Promise<void> {
    await this.profilesRepository.purgeAppData(userId);
  }
}
