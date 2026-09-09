import { decodeSessionsCursor, encodeSessionsCursor } from './sessions-cursor.js';

describe('encodeSessionsCursor / decodeSessionsCursor', () => {
  it('un cursor codificado se decodifica al mismo `started_at`', () => {
    const cursor = encodeSessionsCursor({ started_at: '2026-09-08T10:00:00.000Z' });
    expect(decodeSessionsCursor(cursor)).toEqual({ startedAt: '2026-09-08T10:00:00.000Z' });
  });

  it('el cursor es texto base64url, sin `+`, `/` ni `=`', () => {
    const cursor = encodeSessionsCursor({ started_at: '2026-09-08T10:00:00.000Z' });
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('un cursor con base64 basura lanza (JSON inválido)', () => {
    expect(() => decodeSessionsCursor('%%%no-es-base64%%%')).toThrow();
  });

  it('un cursor que decodifica a JSON válido pero sin `s` lanza', () => {
    const cursor = Buffer.from(JSON.stringify({ x: 1 }), 'utf-8').toString('base64url');
    expect(() => decodeSessionsCursor(cursor)).toThrow();
  });

  it('un cursor con `s` que no es una fecha ISO válida lanza', () => {
    const cursor = Buffer.from(JSON.stringify({ s: 'no-es-una-fecha' }), 'utf-8').toString(
      'base64url',
    );
    expect(() => decodeSessionsCursor(cursor)).toThrow();
  });

  it('un cursor vacío lanza', () => {
    expect(() => decodeSessionsCursor('')).toThrow();
  });
});
