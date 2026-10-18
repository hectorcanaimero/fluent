/**
 * Guardia de idioma: Fluent es para practicar inglés, así que lo que dice el
 * entrevistador tiene que estar en inglés aunque la oferta venga en portugués
 * o español (2026-10-18: una apertura salió entera en portugués).
 *
 * Heurística sin dependencias, la misma que
 * `apps/interview-agent/app/prepare/language.py`; las dos se prueban contra
 * `testdata/english-vectors.json` en la raíz del repo. Pensada para frases
 * cortas habladas: cuenta palabras gramaticales de portugués/español (y letras
 * que el inglés no usa) contra las del inglés. Un nombre propio con tilde
 * («São Paulo», «Bogotá») no basta para rechazar una frase en inglés.
 */

const WORD = /[a-zà-ÿ']+/g;
const FOREIGN_LETTERS = /[ãõçñáéíóúâêôà]/;

// Palabras gramaticales de pt/es que no son palabras del inglés.
const PT_ES = new Set(
  `o os e em de da das dos na nas ao aos um uma uns umas que se
  para com por pelo pela pelas pelos sobre como qual quais quando onde porque
  você vocês seu sua seus suas meu minha nosso nossa sou é está esta este isso
  isto ser será foi tem ter pode podemos vamos fale conte conta conforme também
  mais muito obrigado obrigada olá bem vindo vinda empresa vaga entrevista
  pergunta resposta experiência projeto trabalho trabalhou
  el la los las una unos unas y es soy tu tú su sus mi usted ustedes
  con del al cómo qué cuál cuáles cuándo dónde por qué hola gracias cuéntame
  puedes puede trabajaste manejaste experiencia proyecto empresa entrevistador
  entrevistadora`.split(/\s+/),
);

const EN = new Set(
  `the a an and or of to in on at for with about from by as is are was were be been
  you your yours i me my we our us they their it its this that these those
  what how why when where which who whom do does did have has had can could would
  should will tell walk describe give thank thanks please okay great`.split(/\s+/),
);

/** `false` cuando la frase está, con claridad, en portugués o español. */
export function looksEnglish(text: string): boolean {
  if (text.includes('¿') || text.includes('¡')) return false;
  const words = text.toLowerCase().match(WORD) ?? [];
  if (words.length < 3) return true;
  let foreign = 0;
  let english = 0;
  for (const word of words) {
    if (PT_ES.has(word) || FOREIGN_LETTERS.test(word)) foreign += 1;
    if (EN.has(word)) english += 1;
  }
  return !(foreign >= 2 && foreign > english);
}
