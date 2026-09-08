import { Injectable } from '@nestjs/common';
import { ApiException } from '../common/api-error.js';
import type { Group, Locale, Profile } from '../db/schema.js';
import { GroupsRepository } from '../groups/groups.repository.js';
import { I18nService } from '../i18n/i18n.service.js';
import { ProfilesRepository } from '../profiles/profiles.repository.js';

export interface OwnGroup {
  readonly profile: Profile;
  readonly group: Group;
  readonly locale: Locale;
}

/**
 * `GET /leaderboard`, `GET /challenges` y `GET /weekly-summary` necesitan
 * grupo (alcance de T7, punto 5): sin uno, `409 NOT_ONBOARDED`, igual que
 * hace `GroupsService.requireOwnGroup` (`apps/api/src/groups/groups.service.ts`)
 * para `GET /group`.
 *
 * Esta clase **duplica** intencionalmente esa lógica en vez de que
 * `SocialModule` importe `GroupsModule` para reutilizar el método privado de
 * `GroupsService`: `requireOwnGroup` no está exportado (es privado) y
 * cambiar su visibilidad tocaría un archivo ya fusionado de PR-02/T2 sin
 * necesidad real (docs/specs/pendientes/PR-02.md). Si un PR futuro quiere
 * unificarlas, es un cambio mecánico: extraer este mismo cuerpo a un
 * servicio compartido que ambos módulos importen.
 */
@Injectable()
export class GroupAccessService {
  constructor(
    private readonly profilesRepository: ProfilesRepository,
    private readonly groupsRepository: GroupsRepository,
    private readonly i18n: I18nService,
  ) {}

  async requireOwnGroup(userId: string, acceptLanguageHeader?: string): Promise<OwnGroup> {
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
}
