import { ApiException, type ApiErrorCode } from '../common/api-error.js';
import type { PostgrestErrorLike } from './insforge-result.js';

/**
 * Mensajes que las funciones RPC de PR-01 lanzan con `RAISE EXCEPTION
 * '<mensaje>'` y llegan en `error.message` (PostgREST los reporta con
 * `code: 'P0001'`), mapeados al código de error de SPEC-02 §6 que le
 * corresponde.
 *
 * `PROFILE_NOT_FOUND` (que `redeem_invitation` puede lanzar, SPEC-01 §5) no
 * es un código de SPEC-02 §6: en el uso normal de esta API no debería
 * ocurrir nunca, porque `ProfilesRepository.ensureProfile` crea el perfil de
 * forma perezosa antes de llamar a la RPC (ver docs/specs/pendientes/PR-02.md).
 * Si aun así ocurriera (una carrera muy rara), se trata como `NOT_ONBOARDED`
 * («falta perfil o grupo para la acción»), que es semánticamente lo mismo.
 */
export const RPC_ERROR_TO_API_CODE: Readonly<Record<string, ApiErrorCode>> = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  PROFILE_NOT_FOUND: 'NOT_ONBOARDED',
  ALREADY_IN_GROUP: 'ALREADY_IN_GROUP',
  INVITATION_INVALID: 'INVITATION_INVALID',
  INVITATION_USED: 'INVITATION_USED',
  INVITATION_EXPIRED: 'INVITATION_EXPIRED',
};

/**
 * Código de error de SPEC-02 §6 para el mensaje de una excepción de RPC, si
 * se conoce. Función pura, sin dependencias de Nest ni de i18n: es el punto
 * que cubren los tests unitarios de «mapeo de errores de RPC».
 */
export function mapRpcErrorMessage(message: string): ApiErrorCode | undefined {
  return RPC_ERROR_TO_API_CODE[message];
}

/**
 * Traduce el `error` de una llamada RPC a la `ApiException` que le
 * corresponde. `messageForCode` recibe el código ya resuelto y devuelve el
 * texto para humanos (normalmente `I18nService.translate(code, locale)`);
 * así este módulo no depende de i18n ni de Nest.
 *
 * Si el mensaje no se reconoce, no es un error de dominio: se devuelve un
 * `Error` genérico (fallo inesperado de la función SQL o de la conexión),
 * igual que `unwrapInsforge` para las consultas que no son RPC.
 */
export function toRpcError(
  error: PostgrestErrorLike,
  messageForCode: (code: ApiErrorCode) => string,
): ApiException | Error {
  const code = mapRpcErrorMessage(error.message);

  if (code) {
    return ApiException.of(code, messageForCode(code));
  }

  return new Error(
    `Error de RPC no mapeado: ${error.message} (code=${error.code ?? '?'})`,
    { cause: error },
  );
}
