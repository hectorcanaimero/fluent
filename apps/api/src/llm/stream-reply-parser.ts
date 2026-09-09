/**
 * Parser incremental del campo `reply` (SPEC-04 §4, «Streaming (RF-3.8, P1)»).
 *
 * El modelo devuelve un objeto JSON (`{"reply": "...", "corrections": [...]}`),
 * pero la app quiere ver el texto del tutor mientras se genera. Esta clase
 * consume los trozos del cuerpo tal y como llegan —sin ninguna garantía de que
 * caigan en fronteras útiles: un trozo puede partir un escape `\uXXXX` por la
 * mitad— y va devolviendo los *deltas* ya decodificados del valor de `reply`.
 *
 * Propiedades que hay que mantener (son el criterio de aceptación de PR-04/T4):
 *
 * 1. La concatenación de todo lo que devuelve `push()` (más `end()`) es
 *    **exactamente** el valor de `reply` que produciría `JSON.parse`, sea cual
 *    sea el troceado.
 * 2. Solo se emite el contenido de `reply`: el de `corrections` (o el de
 *    cualquier otra clave) se salta sin emitir nada.
 * 3. Tolera prosa antes del `{` (y vallas markdown ```json), igual que
 *    `extractFirstJsonObject`; si el primer `{` no abre un objeto reconocible
 *    se reintenta con el siguiente, siempre que todavía no se haya emitido nada.
 * 4. Nunca lanza. Si la estructura no se reconoce se marca `failed` y deja de
 *    emitir; quien llama sigue con el texto acumulado completo y lo valida
 *    igual que en el modo no streaming (por eso el `done` del endpoint SSE es
 *    la fuente de verdad, ver `turn-stream.ts`).
 *
 * Clase pura: sin NestJS, sin E/S y sin dependencias.
 */

/** Clave del objeto de salida cuyo valor se emite en directo (`TurnOutput`). */
export const REPLY_KEY = 'reply';

type State =
  | 'seek_object'
  | 'seek_key'
  | 'in_key'
  | 'after_key'
  | 'value_start'
  | 'in_reply'
  | 'skip_structured'
  | 'skip_scalar'
  | 'after_value'
  | 'done'
  | 'failed';

/** Escapes JSON de un solo carácter (`\uXXXX` se trata aparte). */
const SIMPLE_ESCAPES: Readonly<Record<string, string>> = Object.freeze({
  '"': '"',
  '\\': '\\',
  '/': '/',
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
});

const WHITESPACE = new Set([' ', '\t', '\n', '\r']);

/** Fin de un valor escalar (número, `true`, `false`, `null`) que se está saltando. */
const SCALAR_END = new Set([',', '}', ']', ' ', '\t', '\n', '\r']);

const HEX = /^[0-9a-fA-F]{4}$/;

function isHighSurrogate(char: string): boolean {
  const code = char.charCodeAt(0);
  return code >= 0xd800 && code <= 0xdbff;
}

export class StreamReplyParser {
  private state: State = 'seek_object';
  /** Texto pendiente de consumir. Se recorta cuando ya no se puede rebobinar. */
  private buffer = '';
  private pos = 0;

  /** Nombre de la clave que se está leyendo. */
  private key = '';
  /** ¿La clave en curso es `reply` (y en el nivel superior del objeto)? */
  private isReplyKey = false;

  /** Dentro de `skip_structured`: profundidad de `{`/`[` y estado de cadena. */
  private skipDepth = 0;
  private skipInString = false;
  private skipEscaped = false;

  /** Dentro de `in_reply`: hay una `\` pendiente de resolver. */
  private replyEscape = false;

  /**
   * Una mitad alta de un par sustituto (emoji) que todavía no tiene su mitad
   * baja: se retiene para no emitir nunca medio carácter suelto. Pasa tanto con
   * `😀` como con un emoji literal partido entre dos trozos.
   */
  private pendingHighSurrogate = '';

  /** Índice del `{` candidato en curso, para reintentar con el siguiente. */
  private restartAt: number | null = null;
  /** Una vez emitido el primer carácter ya no se puede rebobinar. */
  private emittedAny = false;
  /** Se descartó al menos un candidato (ver el getter `failed`). */
  private gaveUp = false;

  /** Texto de `reply` reconstruido hasta ahora (útil en tests y depuración). */
  private reply = '';

  /**
   * ¿Se abandonó el parseo?
   *
   * Es `true` tanto si se descartó el objeto de forma definitiva (`abandon`)
   * como si se descartó un candidato y se volvió a buscar otro `{` que nunca
   * llegó. En cuanto se engancha un candidato nuevo vuelve a ser `false`.
   */
  get failed(): boolean {
    if (this.state === 'failed') return true;
    return this.gaveUp && this.state === 'seek_object';
  }

  /** ¿Se leyó el `reply` entero? A partir de aquí `push()` no emite más. */
  get done(): boolean {
    return this.state === 'done';
  }

  /** `reply` reconstruido (parcial mientras el stream sigue abierto). */
  get text(): string {
    return this.reply + this.pendingHighSurrogate;
  }

  /**
   * Consume un trozo del cuerpo y devuelve el delta de `reply` que aporta
   * (cadena vacía si no aporta ninguno). Nunca lanza.
   */
  push(chunk: string): string {
    if (chunk === '' || this.state === 'done' || this.state === 'failed') {
      return '';
    }

    this.buffer += chunk;
    const out: string[] = [];
    this.run(out);
    this.trim();

    const delta = out.join('');
    this.reply += delta;
    if (delta !== '') {
      this.emittedAny = true;
    }
    return delta;
  }

  /**
   * Cierre del stream: devuelve la mitad alta de un par sustituto que se
   * hubiera quedado sin pareja (solo puede pasar con un JSON truncado, que de
   * todas formas fallará al validarse).
   */
  end(): string {
    const pending = this.pendingHighSurrogate;
    this.pendingHighSurrogate = '';
    if (pending !== '') {
      this.reply += pending;
    }
    return pending;
  }

  // -------------------------------------------------------------------------
  // Máquina de estados
  // -------------------------------------------------------------------------

  /** Avanza todo lo que permita el buffer. Sale cuando necesita más caracteres. */
  private run(out: string[]): void {
    for (;;) {
      if (this.state === 'done' || this.state === 'failed') return;
      if (this.pos >= this.buffer.length) return;

      const char = this.buffer[this.pos] as string;

      switch (this.state) {
        case 'seek_object':
          if (char === '{') {
            this.restartAt = this.pos;
            this.pos++;
            this.state = 'seek_key';
          } else {
            this.pos++;
          }
          break;

        case 'seek_key':
          if (WHITESPACE.has(char)) {
            this.pos++;
          } else if (char === '"') {
            this.pos++;
            this.key = '';
            this.state = 'in_key';
          } else if (char === '}') {
            // `{}`: objeto válido y completo, pero sin `reply` que emitir.
            this.pos++;
            this.abandon();
          } else {
            // No es un objeto JSON: se reintenta con el siguiente `{`.
            this.giveUp();
          }
          break;

        case 'in_key':
          this.pos++;
          if (char === '\\') {
            // Escape en el nombre de la clave: no pasa con `reply`, pero se
            // consume el siguiente carácter para no confundir el cierre.
            if (this.pos >= this.buffer.length) {
              this.pos--;
              return;
            }
            this.key += this.buffer[this.pos];
            this.pos++;
          } else if (char === '"') {
            this.isReplyKey = this.key === REPLY_KEY;
            this.state = 'after_key';
          } else {
            this.key += char;
          }
          break;

        case 'after_key':
          if (WHITESPACE.has(char)) {
            this.pos++;
          } else if (char === ':') {
            this.pos++;
            this.state = 'value_start';
          } else {
            this.giveUp();
          }
          break;

        case 'value_start':
          if (WHITESPACE.has(char)) {
            this.pos++;
          } else if (this.isReplyKey) {
            if (char === '"') {
              this.pos++;
              this.replyEscape = false;
              this.state = 'in_reply';
            } else {
              // `reply` tiene que ser una cadena (`TurnOutput`). El objeto es
              // JSON válido, así que es el mismo que devolvería
              // `extractFirstJsonObject`: no se busca otro, se abandona (y la
              // validación de `LlmClient` lo rechazará con `invalid_json`).
              this.abandon();
            }
          } else if (char === '"') {
            this.pos++;
            this.skipInString = true;
            this.skipEscaped = false;
            this.skipDepth = 0;
            this.state = 'skip_structured';
          } else if (char === '{' || char === '[') {
            this.pos++;
            this.skipInString = false;
            this.skipEscaped = false;
            this.skipDepth = 1;
            this.state = 'skip_structured';
          } else {
            this.state = 'skip_scalar';
          }
          break;

        case 'skip_structured':
          this.pos++;
          if (this.skipInString) {
            if (this.skipEscaped) {
              this.skipEscaped = false;
            } else if (char === '\\') {
              this.skipEscaped = true;
            } else if (char === '"') {
              this.skipInString = false;
              if (this.skipDepth === 0) this.state = 'after_value';
            }
          } else if (char === '"') {
            this.skipInString = true;
          } else if (char === '{' || char === '[') {
            this.skipDepth++;
          } else if (char === '}' || char === ']') {
            this.skipDepth--;
            if (this.skipDepth <= 0) this.state = 'after_value';
          }
          break;

        case 'skip_scalar':
          if (SCALAR_END.has(char)) {
            this.state = 'after_value';
          } else {
            this.pos++;
          }
          break;

        case 'after_value':
          if (WHITESPACE.has(char)) {
            this.pos++;
          } else if (char === ',') {
            this.pos++;
            this.state = 'seek_key';
          } else if (char === '}') {
            // Objeto completo y válido sin `reply`: no hay nada que emitir y
            // tampoco tiene sentido buscar otro objeto (ver `value_start`).
            this.pos++;
            this.abandon();
          } else {
            this.giveUp();
          }
          break;

        case 'in_reply':
          if (!this.consumeReplyChar(out)) return;
          break;
      }
    }
  }

  /**
   * Consume un carácter del valor de `reply`. Devuelve `false` cuando hace
   * falta esperar a más texto (escape `\uXXXX` partido entre dos trozos).
   */
  private consumeReplyChar(out: string[]): boolean {
    const char = this.buffer[this.pos] as string;

    if (this.replyEscape) {
      if (char === 'u') {
        // `\uXXXX`: hacen falta los cuatro dígitos completos.
        const hex = this.buffer.slice(this.pos + 1, this.pos + 5);
        if (hex.length < 4) return false;
        this.pos += 5;
        this.replyEscape = false;
        if (!HEX.test(hex)) {
          // Escape inválido: se emite tal cual, sin romper el stream.
          this.emit(out, 'u');
          this.emit(out, hex);
          return true;
        }
        this.emit(out, String.fromCharCode(Number.parseInt(hex, 16)));
        return true;
      }

      this.pos++;
      this.replyEscape = false;
      // Un escape desconocido se emite literal (tolerancia, no reparación).
      this.emit(out, SIMPLE_ESCAPES[char] ?? char);
      return true;
    }

    if (char === '\\') {
      this.pos++;
      this.replyEscape = true;
      return true;
    }

    if (char === '"') {
      this.pos++;
      this.flushPending(out);
      this.state = 'done';
      return true;
    }

    this.pos++;
    this.emit(out, char);
    return true;
  }

  /**
   * Añade texto decodificado al delta, reteniendo una mitad alta de par
   * sustituto hasta tener su pareja (así ningún `token` lleva medio emoji).
   */
  private emit(out: string[], text: string): void {
    if (text === '') return;

    if (text.length === 1 && isHighSurrogate(text)) {
      this.flushPending(out);
      this.pendingHighSurrogate = text;
      return;
    }

    if (this.pendingHighSurrogate !== '') {
      out.push(this.pendingHighSurrogate + text);
      this.pendingHighSurrogate = '';
      return;
    }

    out.push(text);
  }

  private flushPending(out: string[]): void {
    if (this.pendingHighSurrogate !== '') {
      out.push(this.pendingHighSurrogate);
      this.pendingHighSurrogate = '';
    }
  }

  /**
   * Estructura no reconocida. Si todavía no se emitió nada se reintenta con el
   * siguiente `{` (misma tolerancia que `extractFirstJsonObject` con la prosa
   * `Here is {your} answer: {...}`); si ya se emitió, se abandona.
   */
  private giveUp(): void {
    this.gaveUp = true;
    if (!this.emittedAny && this.restartAt !== null) {
      this.pos = this.restartAt + 1;
      this.restartAt = null;
      this.key = '';
      this.isReplyKey = false;
      this.skipDepth = 0;
      this.skipInString = false;
      this.skipEscaped = false;
      this.state = 'seek_object';
      return;
    }
    this.state = 'failed';
  }

  /**
   * Descarte definitivo: el objeto era JSON válido pero no trae un `reply`
   * utilizable. No se busca otro candidato, para no emitir nunca tokens de un
   * objeto distinto del que validará `extractFirstJsonObject` + zod.
   */
  private abandon(): void {
    this.gaveUp = true;
    this.state = 'failed';
  }

  /**
   * Descarta lo ya consumido. Mientras siga siendo posible rebobinar hasta el
   * `{` candidato se conserva desde ahí (el prefijo de un objeto JSON son unas
   * pocas decenas de bytes, no crece con la respuesta).
   */
  private trim(): void {
    const keepFrom = this.restartAt !== null && !this.emittedAny ? this.restartAt : this.pos;
    if (keepFrom <= 0) return;
    this.buffer = this.buffer.slice(keepFrom);
    this.pos -= keepFrom;
    if (this.restartAt !== null) this.restartAt -= keepFrom;
  }
}
