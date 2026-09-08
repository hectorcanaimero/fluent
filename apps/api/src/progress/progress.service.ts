import { Injectable } from '@nestjs/common';
import { ProgressService as GameProgressService } from '../game/progress.service.js';
import { toProgressResultDto } from './progress.mapper.js';
import { InsforgeProgressRepository } from './progress.repository.js';
import type { ProgressResultDto } from './progress.types.js';

/**
 * `GET /progress` (SPEC-02 §4.5, SPEC-07 §1).
 *
 * Adaptador delgado: **toda** la lógica (escalera de niveles, semana ISO,
 * ventanas de 7/30 días de la tendencia de correcciones, estado de la gracia)
 * vive en `ProgressService` de `src/game/progress.service.ts`, que llegó con
 * PR-07/T1. Lo que aporta este PR es lo que le tocaba según el propio
 * comentario de esa clase: el repositorio contra InsForge
 * (`InsforgeProgressRepository`), el DTO con los nombres que espera la app y
 * el cableado con NestJS.
 *
 * Antes de fusionar PR-07 esta clase tenía su propia copia de esa lógica
 * (`level.ts`, `corrections-trend.ts`, `common/iso-week.ts`), documentado como
 * PEND-53; esos archivos se borraron. Ver docs/specs/pendientes/PR-02.md
 * PEND-71.
 */
@Injectable()
export class ProgressService {
  private readonly game: GameProgressService;

  constructor(repository: InsforgeProgressRepository) {
    this.game = new GameProgressService(repository);
  }

  /**
   * No exige grupo (a diferencia de `GET /leaderboard`/`/challenges`/
   * `/weekly-summary`): el progreso es siempre del propio perfil, y el
   * `ensureProfile` del repositorio ya cubre al usuario que todavía no tiene
   * uno (perfil recién creado con `xp=0`, `streak=0`, sin correcciones).
   */
  async getProgress(userId: string, now: Date = new Date()): Promise<ProgressResultDto> {
    return toProgressResultDto(await this.game.getProgress(userId, now));
  }
}
