import {
  appendWeeklyFooter,
  weeklyFooterFor,
  WEEKLY_SUMMARY_MAX_LENGTH,
} from './weekly-footer.js';

const ES_FOOTER = '— Fluent · practicá inglés con tus amigos';
const PT_FOOTER = '— Fluent · pratique inglês com seus amigos';

describe('appendWeeklyFooter (MEJ-41)', () => {
  it('termina el texto con el pie del locale', () => {
    expect(appendWeeklyFooter('Buena semana, equipo.', 'es')).toBe(
      `Buena semana, equipo.\n\n${ES_FOOTER}`,
    );
    expect(appendWeeklyFooter('Boa semana, pessoal.', 'pt-BR')).toBe(
      `Boa semana, pessoal.\n\n${PT_FOOTER}`,
    );
  });

  it('es idempotente: releer un resumen ya marcado no duplica el pie', () => {
    const once = appendWeeklyFooter('Buena semana.', 'es');

    expect(appendWeeklyFooter(once, 'es')).toBe(once);
  });

  it('no cuenta como pie el de otro idioma: lo añade igual', () => {
    const enEspanol = appendWeeklyFooter('Buena semana.', 'es');

    expect(appendWeeklyFooter(enEspanol, 'pt-BR')).toBe(`${enEspanol}\n\n${PT_FOOTER}`);
  });

  it('ignora los espacios finales del LLM', () => {
    expect(appendWeeklyFooter('Buena semana.  \n\n', 'es')).toBe(
      `Buena semana.\n\n${ES_FOOTER}`,
    );
  });

  it('recorta el texto, no el pie, cuando no cabe todo', () => {
    const largo = 'a'.repeat(WEEKLY_SUMMARY_MAX_LENGTH);

    const result = appendWeeklyFooter(largo, 'es');

    expect(result.length).toBeLessThanOrEqual(WEEKLY_SUMMARY_MAX_LENGTH);
    expect(result.endsWith(ES_FOOTER)).toBe(true);
    expect(result).toContain('…');
  });

  it('un texto que cabe justo no se toca', () => {
    const justo = 'a'.repeat(WEEKLY_SUMMARY_MAX_LENGTH - ES_FOOTER.length - 2);

    const result = appendWeeklyFooter(justo, 'es');

    expect(result).toBe(`${justo}\n\n${ES_FOOTER}`);
    expect(result.length).toBe(WEEKLY_SUMMARY_MAX_LENGTH);
  });

  it('con un tope imposible devuelve al menos el pie entero', () => {
    expect(appendWeeklyFooter('Hola', 'es', 10)).toBe(ES_FOOTER);
  });

  it('weeklyFooterFor cubre los dos locales', () => {
    expect(weeklyFooterFor('es')).toBe(ES_FOOTER);
    expect(weeklyFooterFor('pt-BR')).toBe(PT_FOOTER);
  });
});
