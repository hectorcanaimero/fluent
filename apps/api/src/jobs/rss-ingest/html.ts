/**
 * Limpieza de HTML para `summary` (SPEC-05 §3 paso 2).
 *
 * No hace falta una librería nueva para esto (el encargo lo dice
 * explícitamente): quita etiquetas y decodifica las entidades más comunes.
 * Solo se usa como último recurso, cuando `rss-parser` no da ya
 * `item.contentSnippet` (que llega sin HTML).
 */
export function stripHtml(input: string): string {
  return input
    .replace(/<!\[CDATA\[/gi, '')
    .replace(/\]\]>/g, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
