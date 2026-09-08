import { SetMetadata, type CustomDecorator } from '@nestjs/common';

/**
 * Clave de metadata que marca un handler o un controlador como público.
 *
 * `AuthGuard` la lee con `Reflector.getAllAndOverride`, así que el
 * decorador funciona tanto sobre un método como sobre la clase entera (el
 * método gana si ambos la declaran).
 */
export const IS_PUBLIC_KEY = 'fluent:auth:isPublic';

/**
 * Marca una ruta (o un controlador completo) como accesible sin bearer.
 *
 * SPEC-02 §4: «Todos requieren bearer salvo `/health`». Hoy el único uso
 * es `HealthController`.
 *
 * ```ts
 * @Public()
 * @Controller('health')
 * export class HealthController {}
 * ```
 */
export const Public = (): CustomDecorator<string> =>
  SetMetadata(IS_PUBLIC_KEY, true);
