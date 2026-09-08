import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import {
  API_ERROR_STATUS,
  ApiException,
  type ApiErrorBody,
  type ApiErrorCode,
} from './api-error.js';
import { I18nService } from '../i18n/i18n.service.js';
import type { Env } from '../config/env.js';

/**
 * Traduce el HTTP status de una excepción **nativa** de Nest (no
 * `ApiException`) al código de SPEC-02 §6 (o de sus extensiones,
 * `API_ERROR_STATUS` en `api-error.ts`) que le corresponde.
 *
 * En la práctica, con el resto de PR-02/T3 en su sitio, las únicas
 * excepciones nativas que llegan hasta aquí son:
 * - El `NotFoundException` que Nest lanza solo cuando ninguna ruta coincide
 *   (404, ruta inexistente) — `VALIDATION`/`UNAUTHENTICATED`/`FORBIDDEN` de
 *   este mapa son una red de seguridad por si alguna dependencia futura
 *   lanza un `BadRequestException`/`UnauthorizedException`/
 *   `ForbiddenException` nativo en vez de una `ApiException`.
 * - `ValidationPipe` ya no cae aquí: su `exceptionFactory`
 *   (`validation-pipe.factory.ts`) construye una `ApiException` directamente.
 * - `ThrottlerException` tampoco: `UserThrottlerGuard` sobrescribe
 *   `throwThrottlingException` para lanzar `ApiException.of('RATE_LIMITED', …)`.
 */
const HTTP_STATUS_TO_API_CODE: Readonly<Partial<Record<number, ApiErrorCode>>> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
};

/** Código de reserva para un HTTP status de una excepción nativa no mapeado arriba. */
function fallbackCodeForStatus(status: number): ApiErrorCode {
  return status >= 500 ? 'INTERNAL' : 'VALIDATION';
}

/**
 * Filtro global de excepciones (SPEC-02 §6, `docs/specs/README.md` §«Errores
 * de API»): garantiza que **toda** respuesta de error de la API tiene
 * exactamente la forma `{ error, message, statusCode }` (más `details`/
 * `activeSessionId` cuando aplica), venga la excepción de donde venga.
 *
 * Casos cubiertos:
 * 1. `ApiException` (de un guard, un servicio, o del `exceptionFactory` del
 *    `ValidationPipe`, o de `toRpcError`/`rpc-error.mapper.ts` en un
 *    repositorio): pasa **tal cual** (`getApiBody()`), respetando `extra`
 *    (`details[]`, `activeSessionId`). No se reconstruye nada.
 * 2. `ZodError` (zod 4; `config/env.ts` y los esquemas de `src/llm/`):
 *    `400 VALIDATION` con `details[]` derivados de `error.issues`.
 * 3. Cualquier otra `HttpException` nativa de Nest: se traduce con
 *    `HTTP_STATUS_TO_API_CODE`/`fallbackCodeForStatus`, sin dejar salir
 *    nunca el cuerpo por defecto de Nest.
 * 4. Cualquier otra cosa (incluido un `Error` genérico — por ejemplo el que
 *    lanzan `unwrapInsforge`/`toRpcError` para un fallo de InsForge/RPC no
 *    reconocido como error de dominio, ver `insforge-result.ts` y
 *    `rpc-error.mapper.ts`): `500 INTERNAL`. El mensaje original y el stack
 *    **nunca** se serializan en producción (`NODE_ENV === 'production'`);
 *    fuera de producción el `message` puede incluir el texto original para
 *    depurar, pero el stack jamás sale en el cuerpo — solo se loguea.
 *
 * El código no traduce el mensaje de una `ApiException` (ya viene traducido
 * por quien la lanzó, normalmente con `I18nService.resolveLocale` sobre el
 * perfil del usuario — PR-02/T2). Para los demás casos (donde el filtro
 * decide el texto) solo tiene la cabecera `Accept-Language` disponible (no
 * hay perfil cargado en un filtro global): se resuelve con
 * `I18nService.resolveLocale(null, acceptLanguage)`.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  constructor(
    private readonly i18nService: I18nService,
    private readonly configService: ConfigService<Env, true>,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const body = this.buildBody(exception, request);

    this.logException(exception, body, request);

    response.status(body.statusCode).json(body);
  }

  private buildBody(
    exception: unknown,
    request: Request,
  ): ApiErrorBody & Record<string, unknown> {
    if (exception instanceof ApiException) {
      return exception.getApiBody();
    }

    if (exception instanceof ZodError) {
      return this.fromZodError(exception, request);
    }

    if (exception instanceof HttpException) {
      return this.fromHttpException(exception, request);
    }

    return this.fromUnknown(exception, request);
  }

  private fromZodError(
    error: ZodError,
    request: Request,
  ): ApiErrorBody & Record<string, unknown> {
    const locale = this.resolveLocale(request);
    const details = error.issues.map((issue) => ({
      field: issue.path.length > 0 ? issue.path.join('.') : '(root)',
      reason: issue.message,
    }));

    return {
      error: 'VALIDATION',
      message: this.i18nService.translate('VALIDATION', locale),
      statusCode: API_ERROR_STATUS.VALIDATION,
      details,
    };
  }

  private fromHttpException(
    exception: HttpException,
    request: Request,
  ): ApiErrorBody & Record<string, unknown> {
    const statusCode = exception.getStatus();
    const code = HTTP_STATUS_TO_API_CODE[statusCode] ?? fallbackCodeForStatus(statusCode);
    const locale = this.resolveLocale(request);
    const translated = this.i18nService.translate(code, locale);

    return {
      error: code,
      // Fuera de producción, el mensaje original de Nest ayuda a depurar
      // (por ejemplo «Cannot GET /v1/no-existe»); en producción siempre el
      // texto genérico traducido, nunca el de la excepción.
      message: this.isProduction() ? translated : this.safeExceptionMessage(exception) ?? translated,
      statusCode,
    };
  }

  private fromUnknown(
    exception: unknown,
    request: Request,
  ): ApiErrorBody & Record<string, unknown> {
    const locale = this.resolveLocale(request);
    const translated = this.i18nService.translate('INTERNAL', locale);

    return {
      error: 'INTERNAL',
      // Nunca el mensaje original ni el stack en producción (alcance de
      // PR-02/T3): solo el texto genérico. Fuera de producción, el mensaje
      // original ayuda a depurar — el stack, aun así, solo se loguea, nunca
      // se serializa en el cuerpo de la respuesta.
      message: this.isProduction() ? translated : this.safeExceptionMessage(exception) ?? translated,
      statusCode: API_ERROR_STATUS.INTERNAL,
    };
  }

  private resolveLocale(request: Request) {
    const header = request.headers['accept-language'];
    const acceptLanguage = Array.isArray(header) ? header[0] : header;
    return this.i18nService.resolveLocale(null, acceptLanguage);
  }

  private isProduction(): boolean {
    return this.configService.get('NODE_ENV', { infer: true }) === 'production';
  }

  /** `message` de un `Error`, sin más (nunca el stack). `undefined` si no es un `Error`. */
  private safeExceptionMessage(exception: unknown): string | undefined {
    return exception instanceof Error ? exception.message : undefined;
  }

  /**
   * Loguea la excepción con el logger de Nest (nestjs-pino, nivel `error`
   * para 5xx y `warn` para 4xx — así un 400/404/429 no ensucia las alertas
   * de error). El stack se loguea siempre que exista (solo aquí, nunca en el
   * cuerpo de la respuesta). No se loguean cabeceras ni el cuerpo de la
   * petición: podrían contener el bearer u otros secretos.
   */
  private logException(
    exception: unknown,
    body: ApiErrorBody & Record<string, unknown>,
    request: Request,
  ): void {
    const line = `${request.method} ${request.originalUrl} -> ${body.statusCode} ${body.error}`;
    const stack = exception instanceof Error ? exception.stack : undefined;

    if (body.statusCode >= 500) {
      this.logger.error(line, stack);
    } else {
      this.logger.warn(line);
    }
  }
}
