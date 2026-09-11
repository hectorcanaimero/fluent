import {
  WORKER_HEARTBEAT_INTERVAL_MS,
  WORKER_HEARTBEAT_KEY,
  WORKER_HEARTBEAT_TTL_SECONDS,
} from './worker-heartbeat.js';

describe('latido del worker (MEJ-27)', () => {
  it('el TTL deja margen para varios latidos perdidos', () => {
    const intervalSeconds = WORKER_HEARTBEAT_INTERVAL_MS / 1000;

    // Con el TTL al triple del intervalo hacen falta tres latidos seguidos
    // perdidos para declararlo enfermo: un pico de carga o un corte breve de
    // Redis no provocan un reinicio.
    expect(WORKER_HEARTBEAT_TTL_SECONDS).toBe(intervalSeconds * 3);
    expect(WORKER_HEARTBEAT_TTL_SECONDS).toBeGreaterThan(intervalSeconds);
  });

  it('la clave es la que lee el HEALTHCHECK', () => {
    expect(WORKER_HEARTBEAT_KEY).toBe('worker:heartbeat');
  });
});
