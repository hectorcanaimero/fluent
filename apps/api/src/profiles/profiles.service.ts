import { Injectable, Logger } from '@nestjs/common';
import { INTERESTS } from '../content/index.js';
import { GroupsRepository } from '../groups/groups.repository.js';
import { SessionsQueryRepository } from '../sessions-query/sessions-query.repository.js';
import { startOfUserDay } from '../sessions/user-day.js';
import { PendingActionsService } from './pending-actions.service.js';
import { toGroupDto, toModelPreferenceDto, toProfileDto } from './profile.mapper.js';
import { effectivePlan } from './plan.js';
import { ProfilesRepository } from './profiles.repository.js';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';
import { XP_PROFILE_COMPLETED } from '../config/product.js';
import type { MeDto, UpdateProfileResultDto } from './profiles.types.js';

/** Catálogo de ids de interés, calculado una sola vez (SPEC-02 §4.1). */
const INTERESTS_CATALOG_IDS = INTERESTS.map((interest) => interest.id);

/**
 * `ProfilesModule` (SPEC-02 §4.1): `GET /me`, `PUT /me/profile`, `DELETE /me`.
 */
@Injectable()
export class ProfilesService {
  private readonly logger = new Logger(ProfilesService.name);

  constructor(
    private readonly profilesRepository: ProfilesRepository,
    private readonly groupsRepository: GroupsRepository,
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
      modelPreference,
      activeSessionId,
      pendingActions,
      sessionsToday,
      avatarUrl,
    ] = await Promise.all([
      profile.group_id ? this.groupsRepository.findById(profile.group_id) : Promise.resolve(null),
      this.profilesRepository.getModelPreference(userId),
      this.profilesRepository.getActiveSessionId(userId),
      this.pendingActions.listFor(userId),
      this.sessionsQuery.countValidSessionsSince(userId, since),
      // Quien vinculó Google después de tener perfil no tiene la foto
      // copiada: se completa acá. Un fallo no debe tumbar GET /me.
      profile.avatar_url !== null
        ? Promise.resolve(profile.avatar_url)
        : this.profilesRepository.refreshAvatar(userId).catch(() => null),
    ]);

    return {
      profile: toProfileDto({ ...profile, avatar_url: avatarUrl }),
      group: group ? toGroupDto(group) : null,
      plan: effectivePlan(profile),
      planExpiresAt: profile.plan_expires_at,
      modelPreference: toModelPreferenceDto(modelPreference),
      onboarded: profile.onboarded_at !== null,
      activeSessionId,
      interestsCatalog: INTERESTS_CATALOG_IDS,
      pendingActions,
      sessionsToday,
      courtesySessionAvailable: false,
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
    // Best-effort a propósito: es un bono de gamificación, y el perfil ya
    // está guardado a estas alturas. Si la RPC falla —o todavía no está
    // aplicada su migración—, el onboarding no puede devolver un 500 y
    // hacerle creer al usuario que no se guardó nada.
    const xpAwarded = shouldMarkOnboarded ? await this.awardProfileXp(userId) : 0;

    return {
      // El XP recién concedido no está en la fila que devolvió el UPDATE,
      // porque lo suma la RPC después; se añade aquí para no obligar a la app
      // a recargar `/me` solo para ver su propia recompensa.
      ...toProfileDto(updated),
      xp: toProfileDto(updated).xp + xpAwarded,
      xpAwarded,
    };
  }

  /** Ver el comentario de `updateProfile`: nunca lanza. */
  private async awardProfileXp(userId: string): Promise<number> {
    try {
      return await this.profilesRepository.awardProfileCompleted(
        userId,
        XP_PROFILE_COMPLETED,
      );
    } catch (error) {
      this.logger.warn(
        `No se pudo conceder el XP de perfil completado a ${userId}: ${(error as Error).message}`,
      );
      return 0;
    }
  }

  async deleteAccountData(userId: string): Promise<void> {
    await this.profilesRepository.purgeAppData(userId);
  }
}
