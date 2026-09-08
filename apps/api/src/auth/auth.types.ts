import type { Request } from 'express';

/**
 * Usuario autenticado que `AuthGuard` adjunta a la petición (SPEC-02 §2:
 * «Adjunta `req.user = { id }` y carga el perfil bajo demanda»).
 *
 * Deliberadamente mínimo: el guard solo conoce el `id` que devuelve la
 * introspección de InsForge. El perfil completo (`displayName`, `level`,
 * grupo, etc.) lo cargan los servicios de PR-02/T2 bajo demanda.
 */
export interface AuthenticatedUser {
  readonly id: string;
}

/**
 * `Request` de Express con el usuario adjuntado por `AuthGuard`.
 *
 * `user` es opcional a propósito: en rutas marcadas con `@Public()` el
 * guard no lo rellena, así que cualquier lector debe contemplar
 * `undefined`.
 */
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}
