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
  // Router 9router (OpenAI-compatible): URL base y key del operador.
  NINEROUTER_URL: z.url(),
  NINEROUTER_API_KEY: z.string().min(1),
  FALLBACK_MODELS: z.string().min(1).optional(),
  PROMPT_VERSION: z.coerce.number().int().default(1),
  OWNER_USER_ID: z.uuid(),
  // Tope de turnos por día natural del usuario según su plan (MAL-23). 0 lo desactiva.
  TURNS_DAILY_CAP_FREE: z.coerce.number().int().min(0).default(30),
  TURNS_DAILY_CAP_PRO: z.coerce.number().int().min(0).default(120),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  // Cuenta de servicio de Firebase (JSON en base64) para enviar push por
  // FCM. Sin ella el envío queda desactivado y la API arranca igual.
  FIREBASE_SERVICE_ACCOUNT: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().min(1).optional(),
  ),
  // Secreto del webhook de RevenueCat (F4.1). Sin él `POST /webhooks/revenuecat`
  // responde 404: el cobro queda desactivado.
  REVENUECAT_WEBHOOK_SECRET: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().min(1).optional(),
  ),
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
