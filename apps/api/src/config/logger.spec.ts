import { buildPinoHttpOptions } from './logger.js';

/** Forma mínima de `pinoHttp` que necesitan estas pruebas. */
type Options = {
  level?: string;
  redact?: string[];
  autoLogging?: { ignore?: (req: { url?: string }) => boolean };
};

function options(level: 'info' | 'debug' = 'info'): Options {
  return buildPinoHttpOptions({ LOG_LEVEL: level }) as Options;
}

describe('buildPinoHttpOptions · redacción de credenciales (MAL-17)', () => {
  it('propaga el LOG_LEVEL del entorno', () => {
    expect(options('debug').level).toBe('debug');
  });

  it('redacta el bearer y las cookies de la petición', () => {
    expect(options().redact).toEqual([
      'req.headers.authorization',
      'req.headers.cookie',
    ]);
  });
});

describe('buildPinoHttpOptions · autoLogging del health check (MAL-17)', () => {
  const ignore = () => options().autoLogging!.ignore!;

  it('ignora /v1/health', () => {
    expect(ignore()({ url: '/v1/health' })).toBe(true);
  });

  it('ignora /v1/health con query string', () => {
    expect(ignore()({ url: '/v1/health?probe=coolify' })).toBe(true);
  });

  it('registra el resto de rutas', () => {
    expect(ignore()({ url: '/v1/sessions' })).toBe(false);
    expect(ignore()({ url: '/v1/health/deep' })).toBe(false);
  });

  it('no falla si la petición no trae url', () => {
    expect(ignore()({})).toBe(false);
  });
});
