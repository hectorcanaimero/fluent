import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { ConfigService } from '@nestjs/config';
import { APP_VERSION } from './config/version.js';
import type { Env } from './config/env.js';

/**
 * Configura OpenAPI (Swagger) en la app NestJS.
 *
 * Esta función se usa tanto desde `main.ts` (app en producción) como desde
 * los tests e2e (app en modo test), para evitar duplicación de la
 * configuración (SPEC-02 §8).
 *
 * `NODE_ENV === 'production'`: si no hay un middleware de autorización
 * instalado antes, esta función monta uno que verifica el bearer del owner.
 * El middleware no se instala aquí (responsabilidad de quien llama esta
 * función desde `main.ts`), pero se documenta para claridad.
 */
export function setupOpenApi(
  app: INestApplication,
  configService?: ConfigService<Env, true>,
  options: { installAuthMiddleware?: boolean } = {},
): void {
  const nodeEnv = configService?.get('NODE_ENV', { infer: true }) ?? 'development';

  // El documento siempre se crea. La visibilidad se controla con middleware
  // en producción (si `installAuthMiddleware` es true; ver main.ts).
  const config = new DocumentBuilder()
    .setTitle('Fluent API')
    .setDescription('API de aprendizaje de idiomas')
    .setVersion(APP_VERSION)
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // `v1/docs` es la ruta exacta donde queda la UI. `SwaggerModule.setup` no
  // aplica el prefijo global (`v1`), así que hay que escribirlo explícitamente.
  // El JSON queda en `/v1/docs-json` automáticamente.
  SwaggerModule.setup('v1/docs', app, document);

  // En tests e2e, el middleware de autorización no se instala (todos pueden
  // ver Swagger). En producción, queda instalado por `main.ts`.
  if (nodeEnv === 'production' && options.installAuthMiddleware) {
    // El middleware se instalaría aquí si fuera responsabilidad de esta función,
    // pero lo maneja `main.ts` para mantener una separación clara.
    // Ver comentario en `main.ts`.
  }
}
