/**
 * Tokens de inyección de dependencias para las conexiones de Redis.
 *
 * `RedisModule` es `@Global()`, así que cualquier módulo de un PR futuro
 * puede inyectar estos tokens sin volver a importar `RedisModule`:
 *
 * ```ts
 * constructor(@Inject(REDIS_QUEUE_CLIENT) private readonly queueRedis: Redis) {}
 * ```
 *
 * Ver SPEC-08 (arquitectura) y SPEC-02 §2: dos conexiones lógicas separadas
 * sobre el mismo Redis físico (`REDIS_URL`) porque BullMQ requiere su propia
 * conexión dedicada (bloqueante para algunos comandos), y la caché de
 * prompts/noticias/tokens no debe compartirla.
 */
export const REDIS_QUEUE_CLIENT = Symbol('REDIS_QUEUE_CLIENT');
export const REDIS_CACHE_CLIENT = Symbol('REDIS_CACHE_CLIENT');
