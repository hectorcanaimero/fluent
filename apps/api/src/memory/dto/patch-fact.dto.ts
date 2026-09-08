import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import type { FactStatus } from '../../db/schema.js';

/** `status` de `PATCH /memory/facts/:id`: nunca `'pending'` (SPEC-02 §4.4). */
const PATCHABLE_FACT_STATUSES: readonly FactStatus[] = ['confirmed', 'dismissed'];
type PatchableFactStatus = 'confirmed' | 'dismissed';

/** Máximo de `facts.text` (SPEC-01 §2.9, CHECK `char_length(text) BETWEEN 1 AND 160`). */
export const FACT_TEXT_MAX_LENGTH = 160;

/**
 * `PATCH /memory/facts/:id` (SPEC-02 §4.4).
 *
 * SPEC-02 §4.4 marca `status` como el campo obligatorio y `text` como
 * opcional, pero la pantalla de memoria de SPEC-06 §4.5 también permite
 * editar el texto de un hecho ya confirmado **sin** cambiar su estado (toque
 * para editar en "Lo que recuerdo"; ver
 * `apps/mobile/lib/features/memory/presentation/memory_screen.dart`, que
 * llama `patchFact(factId: ..., text: newText)` sin `status`). PEND-41:
 * ambos campos son opcionales aquí; `MemoryService` exige que llegue al
 * menos uno (`class-validator` no valida "al menos uno de dos campos
 * opcionales" sin un decorador a medida, y no vale la pena uno solo para
 * esto).
 */
export class PatchFactDto {
  @IsOptional()
  @IsIn(PATCHABLE_FACT_STATUSES)
  status?: PatchableFactStatus;

  @IsOptional()
  @IsString()
  @Length(1, FACT_TEXT_MAX_LENGTH)
  text?: string;
}
