import { HttpException } from '@nestjs/common';

/**
 * Códigos de error de la API y su HTTP por defecto.
 *
 * Fuente única: SPEC-02 §6 (tabla «Códigos de error»). El contrato de
 * respuesta, definido en docs/specs/README.md, es siempre exactamente:
 *
 * ```json
 * { "error": "CODIGO_EN_MAYUSCULAS", "message": "texto para humanos", "statusCode": 401 }
 * ```
 *
 * Este mapa es la fuente de verdad del HTTP asociado a cada código. Si en
 * el futuro se añade un código a SPEC-02 §6, se añade aquí y el tipo
 * `ApiErrorCode` se amplía solo.
 */
export const API_ERROR_STATUS = {
  /** Token ausente o inválido. */
  UNAUTHENTICATED: 401,
  /** Recurso de otro usuario o acción reservada al owner. */
  FORBIDDEN: 403,
  /** Falta perfil o grupo para la acción. */
  NOT_ONBOARDED: 409,
  /** DTO inválido; el filtro global de T3 añadirá `details[]`. */
  VALIDATION: 400,
  INVITATION_INVALID: 400,
  INVITATION_USED: 400,
  INVITATION_EXPIRED: 400,
  ALREADY_IN_GROUP: 409,
  /** Intenta abrir sesión sin credencial activa del proveedor. */
  PROVIDER_NOT_CONNECTED: 409,
  PROVIDER_KEY_INVALID: 400,
  /** Modelo fuera del catálogo o sin credencial del proveedor. */
  MODEL_NOT_AVAILABLE: 400,
  /** Turno sobre una sesión ya cerrada. */
  SESSION_NOT_ACTIVE: 409,
  /** Ya hay una sesión activa; la respuesta incluye `activeSessionId`. */
  SESSION_ALREADY_ACTIVE: 409,
  /**
   * `challengeFromUserId` que no corresponde a ningún desafío ofrecido hoy a
   * este usuario (SPEC-07 §7). 422 y no 400 porque el cuerpo está bien
   * formado: lo que falla es la regla de negocio. Ver MAL-19.
   */
  CHALLENGE_NOT_AVAILABLE: 422,
  /**
   * Acción que exige pertenecer a un grupo y el perfil no tiene `group_id`
   * (MEJ-33): abrir una sesión —incluida la de cortesía— o invitar a un
   * amigo. 422 y no 409 `NOT_ONBOARDED` porque el perfil sí está completo:
   * lo único que falta es canjear un código de invitación, y la app
   * distingue los dos casos con pantallas distintas.
   */
  GROUP_REQUIRED: 422,
  /**
   * El miembro ya tiene el máximo de invitaciones vivas (sin canjear y sin
   * caducar) que puede repartir (MEJ-41). 422 por la misma razón que
   * `GROUP_REQUIRED`: la petición está bien formada y es la regla de negocio
   * la que la rechaza.
   */
  /** Elegir un modelo de pago con el plan Free (F2.2). */
  PLAN_REQUIRED: 403,
  /** Agotada la cadena de fallback de proveedores (RF-2.5). */
  LLM_UNAVAILABLE: 503,
  /** Límites de SPEC-02 §7. */
  RATE_LIMITED: 429,
  /**
   * Tope diario de turnos alcanzado (MAL-23). 429 como `RATE_LIMITED`, pero
   * con código propio: la respuesta lleva `Retry-After` con los segundos que
   * faltan para la medianoche del usuario, y el mensaje de la app es otro
   * («mañana seguimos», no «esperá un momento»).
   */
  TURNS_DAILY_CAP: 429,
  /** Resumen semanal aún no generado. */
  NOT_READY: 404,
  /**
   * Ruta inexistente. Extensión de PR-02/T3 (SPEC-02 §6 no define un código
   * para esto): el 404 que Nest genera solo cuando ninguna ruta coincide, no
   * confundir con `NOT_READY` (404 de dominio, resumen semanal) ni con un
   * recurso concreto que no existe (eso lo modela cada dominio con su propio
   * código, por ejemplo `NOT_ONBOARDED`). Ver docs/specs/pendientes/PR-02.md.
   */
  NOT_FOUND: 404,
  /**
   * Cualquier fallo no anticipado (bug, InsForge caído de forma inesperada,
   * excepción de una librería). Extensión de PR-02/T3: SPEC-02 §6 no define
   * código para 500. El filtro global nunca deja salir el mensaje ni el
   * stack originales en producción (ver docs/specs/pendientes/PR-02.md).
   */
  INTERNAL: 500,
} as const satisfies Record<string, number>;

/** Unión de todos los códigos de error de SPEC-02 §6. */
export type ApiErrorCode = keyof typeof API_ERROR_STATUS;

/**
 * Cuerpo exacto que la API devuelve para cualquier error (SPEC-02 §6 y
 * docs/specs/README.md). No lleva más campos obligatorios; extensiones
 * puntuales (`details[]` en `VALIDATION`, `activeSessionId` en
 * `SESSION_ALREADY_ACTIVE`) se añaden con `extra` sin romper esta forma.
 */
export interface ApiErrorBody {
  readonly error: ApiErrorCode;
  readonly message: string;
  readonly statusCode: number;
}

/** Opciones adicionales de `ApiException`. */
export interface ApiExceptionOptions {
  /**
   * Campos extra que se mezclan en el cuerpo de la respuesta junto a
   * `error`, `message` y `statusCode` (por ejemplo `details` o
   * `activeSessionId`). No pueden sobrescribir esos tres campos.
   */
  readonly extra?: Readonly<Record<string, unknown>>;
  /** Error original, para logs. No se serializa en la respuesta. */
  readonly cause?: unknown;
}

/**
 * Excepción de dominio de la API.
 *
 * Nest serializa tal cual el objeto que se pasa como respuesta de una
 * `HttpException`, así que una `ApiException` ya produce el formato de
 * SPEC-02 §6 sin necesidad de ningún filtro global (el filtro de PR-02/T3
 * se encargará del resto de excepciones: las nativas de Nest, las de zod y
 * los errores de InsForge).
 *
 * Uso:
 *
 * ```ts
 * throw ApiException.unauthenticated();
 * throw ApiException.forbidden('Solo el owner del grupo puede hacer esto.');
 * throw new ApiException('INVITATION_EXPIRED', 'La invitación ha caducado.');
 * ```
 */
export class ApiException extends HttpException {
  /** Código de SPEC-02 §6 que provocó el error. */
  readonly code: ApiErrorCode;

  constructor(
    code: ApiErrorCode,
    message: string,
    options: ApiExceptionOptions = {},
  ) {
    const statusCode = API_ERROR_STATUS[code];
    const body: ApiErrorBody = { error: code, message, statusCode };

    // `extra` va primero para que nunca pueda pisar `error`/`message`/`statusCode`.
    super({ ...options.extra, ...body }, statusCode, { cause: options.cause });

    this.code = code;
  }

  /** Cuerpo tipado de la respuesta (lo que Nest serializa). */
  getApiBody(): ApiErrorBody & Record<string, unknown> {
    return this.getResponse() as ApiErrorBody & Record<string, unknown>;
  }

  /**
   * Factoría genérica, cómoda cuando el código se calcula en tiempo de
   * ejecución: `ApiException.of(code, message)`.
   */
  static of(
    code: ApiErrorCode,
    message: string,
    options?: ApiExceptionOptions,
  ): ApiException {
    return new ApiException(code, message, options);
  }

  /**
   * `401 UNAUTHENTICATED`: token ausente, con esquema distinto de Bearer,
   * vacío, expirado o rechazado por InsForge (SPEC-02 §2).
   */
  static unauthenticated(
    message = 'Falta un token de acceso válido.',
    options?: ApiExceptionOptions,
  ): ApiException {
    return new ApiException('UNAUTHENTICATED', message, options);
  }

  /**
   * `403 FORBIDDEN`: recurso de otro usuario o acción reservada al owner
   * del grupo (SPEC-02 §6).
   */
  static forbidden(
    message = 'No tienes permiso para realizar esta acción.',
    options?: ApiExceptionOptions,
  ): ApiException {
    return new ApiException('FORBIDDEN', message, options);
  }
}
