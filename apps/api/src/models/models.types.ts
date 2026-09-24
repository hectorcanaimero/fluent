import type { Provider } from '../db/schema.js';

/**
 * Elemento de un tier en `GET /models` (SPEC-02 §4.2, SPEC-03 §7).
 *
 * Contrato exacto de `apps/mobile/lib/core/api/models.dart::ModelOption`: un
 * único `pricePerMillionUsd` (no dos), que es el precio de **salida** por
 * millón de tokens — SPEC-03 §7 define los tiers por ese precio, y es el
 * número que la pantalla de modelos de la app muestra como "precio por
 * millón" (SPEC-06 §4.6). Decisión documentada en
 * docs/specs/pendientes/PR-02.md.
 */
export interface ModelOptionDto {
  readonly id: string;
  readonly name: string;
  readonly pricePerMillionUsd: number;
}

/** Contrato exacto de `ModelTierGroups` (Dart): los tres tiers de SPEC-03 §7. */
export interface ModelTierGroupsDto {
  readonly free: ModelOptionDto[];
  readonly budget: ModelOptionDto[];
  readonly premium: ModelOptionDto[];
}

/**
 * Cuerpo de `GET /models` (SPEC-02 §4.2). `providers` trae la única clave
 * `9router`, con los tres tiers aunque alguno quede vacío.
 */
export interface ModelsCatalogDto {
  readonly providers: Record<'9router', ModelTierGroupsDto>;
  readonly estimatePerSession: Record<string, number>;
}

/**
 * `modelPreference` **plano** que devuelve `PUT /me/models` (SPEC-02 §4.2),
 * con los mismos nombres de campo que `GET /me`
 * (`apps/api/src/profiles/profiles.types.ts::ModelPreferenceDto`), pero
 * nunca nulo: la escritura siempre deja los cuatro campos con un valor.
 */
export interface ModelPreferenceResultDto {
  readonly chatProvider: Provider;
  readonly chatModel: string;
  readonly briefProvider: Provider;
  readonly briefModel: string;
}
