import { z } from 'zod';

/**
 * Validación de variables de entorno de la API y el worker.
 *
 * Fuente: docs/specs/SPEC-08-infraestructura.md §2.
 *
 * `FALLBACK_MODELS` se valida aquí solo como string no vacío: es JSON
 * serializado y su parseo/forma detallada es responsabilidad de SPEC-03.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  INSFORGE_URL: z.url(),
  INSFORGE_API_KEY: z.string().min(1),
  INSFORGE_ANON_KEY: z.string().min(1),
  REDIS_URL: z.string().min(1),
  CREDENTIALS_MASTER_KEY: z.string().min(1),
  // Solo durante una rotación de clave (SPEC-02 §5). `.env.example` la deja
  // vacía, y dotenv entrega esas líneas como `''`, así que una cadena vacía
  // (o solo espacios) se trata como «no configurada» en vez de fallar el
  // arranque. Ver docs/specs/pendientes/PR-02.md PEND-30.
  CREDENTIALS_MASTER_KEY_PREVIOUS: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().min(1).optional(),
  ),
  OPENROUTER_OAUTH_CALLBACK: z.string().min(1),
  // URL pública de la API (sin barra final): base del callback HTTPS del PKCE de OpenRouter.
  API_PUBLIC_URL: z.url().default('https://fluent.usebot.chat'),
  FALLBACK_MODELS: z.string().min(1),
  PROMPT_VERSION: z.coerce.number().int().default(1),
  OWNER_USER_ID: z.uuid(),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Valida `process.env` (o cualquier objeto de configuración) contra el
 * schema de entorno. Lanza `ZodError` si algo falta o no cumple el formato;
 * `@nestjs/config` captura esa excepción y falla el arranque con un mensaje
 * claro (ver `ConfigModule.forRoot({ validate: validateEnv })` en AppModule).
 */
export function validateEnv(config: Record<string, unknown>): Env {
  return envSchema.parse(config);
}
