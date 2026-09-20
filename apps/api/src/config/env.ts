import { z } from 'zod';

/**
 * Validación de variables de entorno de la API y el worker.
 *
 * Fuente: docs/specs/SPEC-08-infraestructura.md §2.
 *
 * `FALLBACK_MODELS` se valida aquí solo como string no vacío: es JSON
 * serializado y su parseo/forma detallada es responsabilidad de SPEC-03.
 */
/** Valor por defecto de `API_PUBLIC_URL`: la API desplegada. */
export const PRODUCTION_API_PUBLIC_URL = 'https://fluent.usebot.chat';

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
  // Deep link de la app (o una URL https) adonde vuelve el navegador tras el
  // PKCE de OpenRouter. Se valida el esquema porque acá llegó a quedar
  // pegada una API key de OpenRouter: el callback redirigía a la clave.
  OPENROUTER_OAUTH_CALLBACK: z
    .string()
    .refine(
      (value) => value.startsWith('fluent://') || value.startsWith('https://'),
      'OPENROUTER_OAUTH_CALLBACK debe empezar con fluent:// o https://',
    ),
  // URL pública de ESTA API (sin barra final): base del callback HTTPS del
  // PKCE de OpenRouter. Su valor por defecto apunta a producción, así que una
  // API local que no la defina manda el navegador a producción, cuyo Redis no
  // conoce el intento (ver `warnIfSuspiciousEnv`).
  API_PUBLIC_URL: z.url().default(PRODUCTION_API_PUBLIC_URL),
  FALLBACK_MODELS: z.string().min(1),
  PROMPT_VERSION: z.coerce.number().int().default(1),
  OWNER_USER_ID: z.uuid(),
  // Tope de turnos por día natural del usuario (MAL-23). 0 lo desactiva.
  TURNS_DAILY_CAP: z.coerce.number().int().min(0).default(120),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  // Cuenta de servicio de Firebase (JSON en base64) para enviar push por
  // FCM. Sin ella el envío queda desactivado y la API arranca igual.
  FIREBASE_SERVICE_ACCOUNT: z.preprocess(
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

/**
 * Avisos de configuración que no justifican fallar el arranque pero sí
 * explican un error difícil de encontrar. Devuelve los mensajes (el llamador
 * los loguea) en vez de escribir por su cuenta, para poder testearlo.
 */
export function suspiciousEnvWarnings(
  env: Pick<Env, 'NODE_ENV' | 'API_PUBLIC_URL'>,
): string[] {
  const warnings: string[] = [];
  if (env.NODE_ENV !== 'production' && env.API_PUBLIC_URL === PRODUCTION_API_PUBLIC_URL) {
    warnings.push(
      `API_PUBLIC_URL apunta a producción (${PRODUCTION_API_PUBLIC_URL}) fuera de producción: ` +
        'el navegador volvería del PKCE de OpenRouter a la API desplegada, que no conoce el ' +
        'intento. Defínela con la URL pública de esta API.',
    );
  }
  return warnings;
}
