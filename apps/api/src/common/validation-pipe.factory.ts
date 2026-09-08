import { ValidationPipe, type ValidationError } from '@nestjs/common';
import { ApiException } from './api-error.js';
import type { I18nService } from '../i18n/i18n.service.js';

/** Un elemento de `details[]` en el cuerpo de un `400 VALIDATION` (SPEC-02 §6). */
export interface ValidationDetail {
  readonly field: string;
  readonly reason: string;
}

/**
 * Aplana el árbol de `ValidationError[]` que produce `class-validator` (uno
 * por propiedad del DTO, con `children` para DTOs anidados) a la lista plana
 * de `{ field, reason }` que pide SPEC-02 §6 («`details[]` con campo y
 * motivo»). `field` usa notación de punto para las propiedades anidadas
 * (`profile.timezone`), y cada `constraint` de `class-validator` se reporta
 * como un detalle propio (una propiedad puede fallar varias validaciones a
 * la vez).
 */
export function flattenValidationErrors(
  errors: readonly ValidationError[],
  parentField = '',
): ValidationDetail[] {
  const details: ValidationDetail[] = [];

  for (const error of errors) {
    const field = parentField ? `${parentField}.${error.property}` : error.property;

    if (error.constraints) {
      for (const reason of Object.values(error.constraints)) {
        details.push({ field, reason });
      }
    }

    if (error.children && error.children.length > 0) {
      details.push(...flattenValidationErrors(error.children, field));
    }
  }

  return details;
}

/**
 * `ValidationPipe` global (SPEC-02 §8: `whitelist: true`) con un
 * `exceptionFactory` que construye directamente una `ApiException` con
 * `details[]` bien formados, en vez de dejar que Nest lance su
 * `BadRequestException` por defecto (cuerpo `{ message, error, statusCode }`
 * que la app no entiende — ver alcance de PR-02/T3).
 *
 * `exceptionFactory` no recibe la petición HTTP (solo los `ValidationError`),
 * así que no hay forma de resolver el idioma por `Accept-Language` ni por el
 * perfil aquí dentro: el texto genérico de `message` va siempre en español
 * fijo, igual que decidió `AuthGuard` para `UNAUTHENTICATED`
 * (docs/specs/pendientes/PR-02.md, PEND-06). `details[]`, en cambio, no se
 * traduce: son los propios `constraints` de `class-validator`, ya en
 * castellano porque los DTOs de este repo no usan mensajes i18n por campo.
 */
export function createValidationPipe(i18nService: I18nService): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors: ValidationError[]) => {
      const details = flattenValidationErrors(errors);
      const message = i18nService.translate('VALIDATION', 'es');
      return ApiException.of('VALIDATION', message, { extra: { details } });
    },
  });
}
