import {
  configureHttpServer,
  HEADERS_TIMEOUT_MS,
  KEEP_ALIVE_TIMEOUT_MS,
} from './http-server.js';

describe('configureHttpServer · timeouts detrás del proxy (MAL-21)', () => {
  it('sube el keepAliveTimeout por encima de los 60 s de Traefik', () => {
    const server = configureHttpServer({ keepAliveTimeout: 5_000, headersTimeout: 60_000 });

    expect(server.keepAliveTimeout).toBe(KEEP_ALIVE_TIMEOUT_MS);
    expect(server.keepAliveTimeout).toBeGreaterThan(60_000);
  });

  it('deja headersTimeout por encima de keepAliveTimeout', () => {
    const server = configureHttpServer({ keepAliveTimeout: 5_000, headersTimeout: 60_000 });

    expect(server.headersTimeout).toBe(HEADERS_TIMEOUT_MS);
    expect(server.headersTimeout).toBeGreaterThan(server.keepAliveTimeout);
  });

  it('devuelve el mismo servidor que recibe', () => {
    const server = { keepAliveTimeout: 0, headersTimeout: 0 };

    expect(configureHttpServer(server)).toBe(server);
  });
});
