import { describe, it, expect } from 'vitest';
import {
  aggregateSessionsPerDay,
  calculateAvgDurationSec,
  calculateLlmFailureRate,
} from './metrics-aggregation.js';

describe('Agregación de métricas', () => {
  describe('aggregateSessionsPerDay', () => {
    it('devuelve 14 días con count=0 si no hay filas', () => {
      const result = aggregateSessionsPerDay([], new Date('2026-09-09T00:00:00Z'));
      expect(result).toHaveLength(14);
      expect(result.every((item) => item.count === 0)).toBe(true);
      // Ventana de 14 días en UTC que **incluye** el día de `now`.
      expect(result[0].day).toBe('2026-08-27');
      expect(result[13].day).toBe('2026-09-09');
    });

    it('agrega sesiones por día', () => {
      const rows = [
        { started_at: '2026-09-08T10:00:00Z' },
        { started_at: '2026-09-08T14:00:00Z' },
        { started_at: '2026-09-07T09:00:00Z' },
      ];
      const result = aggregateSessionsPerDay(rows, new Date('2026-09-09T00:00:00Z'));

      const day8 = result.find((item) => item.day === '2026-09-08');
      const day7 = result.find((item) => item.day === '2026-09-07');

      expect(day8?.count).toBe(2);
      expect(day7?.count).toBe(1);
    });

    it('los días son UTC, no de la zona horaria de la máquina', () => {
      // 2026-09-09T00:30Z es todavía 2026-09-08 en cualquier zona al oeste de
      // UTC y ya 2026-09-09 al este; el día que se reporta debe ser el UTC.
      // Regresión: `dateOnly` truncaba por la hora local y formateaba con
      // `toISOString()`, así que el VPS (CEST) y el CI (UTC) daban ventanas
      // distintas y el mismo test pasaba en uno y fallaba en el otro.
      const result = aggregateSessionsPerDay(
        [{ started_at: '2026-09-09T00:30:00Z' }],
        new Date('2026-09-09T00:30:00Z'),
      );

      expect(result.at(-1)).toEqual({ day: '2026-09-09', count: 1 });
      expect(result.at(0)?.day).toBe('2026-08-27');
    });

    it('ordena desde el día más antiguo al más reciente', () => {
      const result = aggregateSessionsPerDay([], new Date('2026-09-09T00:00:00Z'));
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].day < result[i + 1].day).toBe(true);
      }
    });

    it('ignora filas con timestamps inválidos', () => {
      const rows = [
        { started_at: '2026-09-08T10:00:00Z' },
        { started_at: 'invalid' },
      ];
      // No debe lanzar, solo ignorar la inválida.
      expect(() => aggregateSessionsPerDay(rows, new Date('2026-09-09T00:00:00Z'))).not.toThrow();
    });
  });

  describe('calculateAvgDurationSec', () => {
    it('devuelve null si no hay filas', () => {
      const result = calculateAvgDurationSec([]);
      expect(result).toBeNull();
    });

    it('devuelve null si todas las duraciones son null', () => {
      const rows = [{ duration_sec: null }, { duration_sec: null }];
      const result = calculateAvgDurationSec(rows);
      expect(result).toBeNull();
    });

    it('calcula la media de duraciones', () => {
      const rows = [{ duration_sec: 100 }, { duration_sec: 200 }, { duration_sec: 300 }];
      const result = calculateAvgDurationSec(rows);
      expect(result).toBe(200);
    });

    it('ignora duraciones null en el cálculo', () => {
      const rows = [{ duration_sec: 100 }, { duration_sec: null }, { duration_sec: 200 }];
      const result = calculateAvgDurationSec(rows);
      expect(result).toBe(150);
    });
  });

  describe('calculateLlmFailureRate', () => {
    it('devuelve rate=0 y totales cero si no hay filas', () => {
      const result = calculateLlmFailureRate([]);
      expect(result.rate).toBe(0);
      expect(result.total).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('devuelve rate=0 si todas son "ok"', () => {
      const rows = [{ status: 'ok' }, { status: 'ok' }, { status: 'ok' }];
      const result = calculateLlmFailureRate(rows);
      expect(result.rate).toBe(0);
      expect(result.total).toBe(3);
      expect(result.failed).toBe(0);
    });

    it('devuelve rate=1 si todas fallan', () => {
      const rows = [{ status: 'timeout' }, { status: 'rate_limited' }];
      const result = calculateLlmFailureRate(rows);
      expect(result.rate).toBe(1);
      expect(result.total).toBe(2);
      expect(result.failed).toBe(2);
    });

    it('calcula la proporción correcta de fallos', () => {
      const rows = [
        { status: 'ok' },
        { status: 'ok' },
        { status: 'timeout' },
        { status: 'provider_error' },
      ];
      const result = calculateLlmFailureRate(rows);
      expect(result.rate).toBe(0.5);
      expect(result.total).toBe(4);
      expect(result.failed).toBe(2);
    });
  });
});
