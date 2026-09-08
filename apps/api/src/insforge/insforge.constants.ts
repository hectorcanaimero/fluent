/**
 * Token de inyección del cliente admin de InsForge (`@insforge/sdk`),
 * exportado por `InsforgeModule` (`@Global()`) para que otros módulos de
 * PRs futuros lo inyecten sin volver a importar el módulo.
 */
export const INSFORGE_ADMIN_CLIENT = Symbol('INSFORGE_ADMIN_CLIENT');
