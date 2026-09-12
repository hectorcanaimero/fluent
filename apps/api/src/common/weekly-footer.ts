import type { Locale } from '../db/schema.js';

/**
 * Pie de marca del resumen semanal (MEJ-41).
 *
 * Lo añade **el código**, nunca el LLM: el prompt de SPEC-03 §4.3 no lo
 * menciona y no debe hacerlo. Un modelo que se despiste, degrade o responda
 * en otro idioma dejaría el resumen sin marca justo cuando más importa, que
 * es al compartirlo fuera de la app (el resumen se comparte como texto plano,
 * sin nada que diga de dónde salió).
 *
 * Se aplica en dos sitios y es idempotente a propósito: al generar el resumen
 * (`jobs/weekly-summary`), para que el pie quede guardado en la fila, y al
 * leerlo (`social/weekly-summary.service`), para que los resúmenes que ya
 * estaban en la tabla antes de MEJ-41 también salgan con marca.
 */
const FOOTER_BY_LOCALE: Record<Locale, string> = {
  es: '— Fluent · practicá inglés con tus amigos',
  'pt-BR': '— Fluent · pratique inglês com seus amigos',
};

/**
 * Tope de longitud del resumen, el mismo que exige `WeeklyOutput` en
 * `llm/schemas.ts`. La columna `weekly_summaries.text` no tiene CHECK, así
 * que este es el único límite real: se respeta igualmente para que un texto
 * releído y vuelto a validar no falle por culpa del pie.
 */
export const WEEKLY_SUMMARY_MAX_LENGTH = 1200;

/** Separador entre el texto del LLM y el pie. */
const SEPARATOR = '\n\n';

export function weeklyFooterFor(locale: Locale): string {
  return FOOTER_BY_LOCALE[locale] ?? FOOTER_BY_LOCALE.es;
}

/**
 * Devuelve `text` terminado siempre en el pie de marca del `locale`.
 *
 * - Si ya termina en ese pie, lo deja igual (no se duplica al releer).
 * - Si texto + pie se pasan de `maxLength`, **recorta el texto**, no el pie,
 *   y marca el corte con «…». El pie es corto y fijo: sacrificar la última
 *   frase del resumen es preferible a publicar media marca.
 */
export function appendWeeklyFooter(
  text: string,
  locale: Locale,
  maxLength: number = WEEKLY_SUMMARY_MAX_LENGTH,
): string {
  const footer = weeklyFooterFor(locale);
  const body = text.trimEnd();

  if (body.endsWith(footer)) {
    return body;
  }

  const suffix = `${SEPARATOR}${footer}`;
  const room = maxLength - suffix.length;

  // Tope tan corto que no cabe ni el pie: se devuelve el pie solo, que es lo
  // único que este helper garantiza. En la práctica no pasa (1200 ≫ 42).
  if (room <= 0) {
    return footer;
  }

  const trimmed =
    body.length <= room ? body : `${body.slice(0, room - 1).trimEnd()}…`;

  return `${trimmed}${suffix}`;
}
