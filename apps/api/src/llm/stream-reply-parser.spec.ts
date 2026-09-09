import { StreamReplyParser } from './stream-reply-parser.js';
import { TurnOutput } from './schemas.js';

/**
 * Criterio de aceptación de PR-04/T4 (docs/tasks/PR-04-sesion.md): «test con
 * stream simulado que emite el JSON en trozos arbitrarios; el texto
 * reconstruido coincide con `reply`».
 */

/** Alimenta el parser con los trozos y devuelve todo lo emitido. */
function feed(chunks: readonly string[]): { text: string; parser: StreamReplyParser } {
  const parser = new StreamReplyParser();
  let text = '';
  for (const chunk of chunks) {
    text += parser.push(chunk);
  }
  text += parser.end();
  return { text, parser };
}

/** Trocea `text` en piezas de `size` caracteres. */
function fixedChunks(text: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    out.push(text.slice(i, i + size));
  }
  return out;
}

/** PRNG determinista (mulberry32): los cortes «aleatorios» son reproducibles. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomChunks(text: string, random: () => number): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    const size = 1 + Math.floor(random() * 12);
    out.push(text.slice(i, i + size));
    i += size;
  }
  return out;
}

const REPLY =
  'Nice! "Yesterday" I went to the gym.\nWhat did you do there?\tTell me — el café ☕ 😀 was great: 100% \\ done.';

const PAYLOAD = {
  reply: REPLY,
  corrections: [
    {
      original: 'I go to gym yesterday',
      corrected: 'I went to the gym yesterday',
      category: 'past_simple',
      note: 'Usa el pasado simple: "I \\"went\\"" — {no} confundas las llaves.',
    },
  ],
};

const JSON_TEXT = JSON.stringify(PAYLOAD);

describe('StreamReplyParser · reconstrucción con troceado arbitrario', () => {
  it('el JSON entero de una vez reconstruye `reply`', () => {
    const { text, parser } = feed([JSON_TEXT]);

    expect(text).toBe(REPLY);
    expect(parser.done).toBe(true);
    expect(parser.failed).toBe(false);
  });

  it('carácter a carácter (todos los cortes de 1) reconstruye `reply`', () => {
    const { text, parser } = feed(fixedChunks(JSON_TEXT, 1));

    expect(text).toBe(REPLY);
    expect(parser.done).toBe(true);
  });

  it('todos los cortes en dos trozos reconstruyen `reply`', () => {
    for (let cut = 0; cut <= JSON_TEXT.length; cut++) {
      const { text } = feed([JSON_TEXT.slice(0, cut), JSON_TEXT.slice(cut)]);
      expect(text, `corte en ${cut}`).toBe(REPLY);
    }
  });

  it('todos los tamaños de trozo fijo reconstruyen `reply`', () => {
    for (let size = 1; size <= JSON_TEXT.length; size++) {
      const { text } = feed(fixedChunks(JSON_TEXT, size));
      expect(text, `trozos de ${size}`).toBe(REPLY);
    }
  });

  it('cortes aleatorios con semilla fija reconstruyen `reply`', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const { text } = feed(randomChunks(JSON_TEXT, mulberry32(seed)));
      expect(text, `semilla ${seed}`).toBe(REPLY);
    }
  });

  it('el texto reconstruido es idéntico al que produce `JSON.parse` (contrato con `TurnOutput`)', () => {
    const { text } = feed(fixedChunks(JSON_TEXT, 3));
    const parsed = TurnOutput.parse(JSON.parse(JSON_TEXT));

    expect(text).toBe(parsed.reply);
  });
});

describe('StreamReplyParser · escapes', () => {
  const cases: ReadonlyArray<readonly [string, string]> = [
    ['comillas', 'Say "hello" now'],
    ['barra invertida', 'C:\\\\path\\\\to'],
    ['saltos de línea', 'one\ntwo\r\nthree'],
    ['tabulador y control', 'a\tb\u0007c'],
    ['acentos y símbolos', 'el café costó 3 € — ¿vale?'],
    ['emoji (par sustituto)', 'me encantó 😀🎉 mucho'],
    ['barra escapada', 'ver https://fluent.app/es'],
  ];

  it.each(cases)('%s', (_name, reply) => {
    const json = JSON.stringify({ reply, corrections: [] });
    for (const size of [1, 2, 3, 7]) {
      const { text } = feed(fixedChunks(json, size));
      expect(text, `trozos de ${size}`).toBe(reply);
    }
  });

  it('nunca emite media mitad de un par sustituto', () => {
    const reply = '😀 hola 🎉';
    const json = JSON.stringify({ reply });
    const parser = new StreamReplyParser();
    const deltas: string[] = [];
    for (const chunk of fixedChunks(json, 1)) {
      const delta = parser.push(chunk);
      if (delta !== '') deltas.push(delta);
    }
    deltas.push(parser.end());

    for (const delta of deltas) {
      // Un `token` con medio emoji llegaría roto a la app (y a `JSON.stringify`).
      expect(delta).toBe(delta.toWellFormed());
    }
    expect(deltas.join('')).toBe(reply);
  });

  it('acepta `\\uXXXX` en mayúsculas y minúsculas, partido en cualquier punto', () => {
    const json = '{"reply":"a\\u00E9b\\u00e9c"}';
    for (let size = 1; size <= json.length; size++) {
      const { text } = feed(fixedChunks(json, size));
      expect(text, `trozos de ${size}`).toBe('aébéc');
    }
  });
});

describe('StreamReplyParser · tolerancia', () => {
  it('ignora la prosa anterior al `{`', () => {
    const json = `Sure! Here is the JSON you asked for:\n\n${JSON_TEXT}`;
    const { text } = feed(fixedChunks(json, 5));

    expect(text).toBe(REPLY);
  });

  it('ignora una valla markdown ```json', () => {
    const json = '```json\n{"reply":"Hi there!","corrections":[]}\n```';
    const { text } = feed(fixedChunks(json, 4));

    expect(text).toBe('Hi there!');
  });

  it('reintenta con el siguiente `{` si el primero era prosa', () => {
    const json = `Here is {your} answer: ${JSON_TEXT}`;
    const { text, parser } = feed(fixedChunks(json, 6));

    expect(text).toBe(REPLY);
    expect(parser.failed).toBe(false);
  });

  it('no emite nada mientras solo ha llegado prosa', () => {
    const parser = new StreamReplyParser();

    expect(parser.push('Claro, aquí tienes ')).toBe('');
    expect(parser.push('el resultado:\n')).toBe('');
    expect(parser.failed).toBe(false);
    expect(parser.push('{"reply":"Hi"}')).toBe('Hi');
  });
});

describe('StreamReplyParser · solo emite `reply`', () => {
  it('las `corrections` que van antes no ensucian los tokens', () => {
    const json = JSON.stringify({ corrections: PAYLOAD.corrections, reply: REPLY });
    const { text } = feed(fixedChunks(json, 3));

    expect(text).toBe(REPLY);
  });

  it('un `reply` anidado dentro de `corrections` no se emite', () => {
    const json = JSON.stringify({
      corrections: [{ original: 'a', corrected: 'b', category: 'other', note: 'reply' }],
      reply: 'el de verdad',
    });
    const { text } = feed(fixedChunks(json, 2));

    expect(text).toBe('el de verdad');
  });

  it('deja de emitir en cuanto se cierra el valor de `reply`', () => {
    const json = JSON.stringify({ reply: 'Hi', corrections: PAYLOAD.corrections });
    const parser = new StreamReplyParser();
    let text = '';
    for (const chunk of fixedChunks(json, 1)) {
      text += parser.push(chunk);
    }

    expect(text).toBe('Hi');
    expect(parser.done).toBe(true);
  });

  it('salta claves con valores de cualquier tipo antes de `reply`', () => {
    const json =
      '{"id":123,"ok":true,"nada":null,"meta":{"a":[1,2,{"b":"}"}],"c":"x"},"reply":"Bien"}';
    for (const size of [1, 3, 11]) {
      const { text } = feed(fixedChunks(json, size));
      expect(text, `trozos de ${size}`).toBe('Bien');
    }
  });
});

describe('StreamReplyParser · estructura irreconocible', () => {
  it('un texto sin ningún `{` no falla ni emite: simplemente espera', () => {
    const { text, parser } = feed(['Lo siento, no puedo responder a eso.']);

    expect(text).toBe('');
    expect(parser.failed).toBe(false);
    expect(parser.done).toBe(false);
  });

  it('un objeto sin `reply` se marca `failed` sin emitir nada', () => {
    const { text, parser } = feed(fixedChunks('{"corrections":[],"answer":"Hi"}', 2));

    expect(text).toBe('');
    expect(parser.failed).toBe(true);
  });

  it('un JSON mal formado se marca `failed` y deja de emitir', () => {
    const { text, parser } = feed(["{reply: 'Hi'}"]);

    expect(text).toBe('');
    expect(parser.failed).toBe(true);
  });

  it('un `reply` que no es una cadena se marca `failed`', () => {
    const { text, parser } = feed(fixedChunks('{"reply":42,"corrections":[]}', 2));

    expect(text).toBe('');
    expect(parser.failed).toBe(true);
  });

  it('`failed` es definitivo: no vuelve a emitir aunque llegue un JSON bueno', () => {
    const parser = new StreamReplyParser();
    parser.push('{"reply":true}');
    expect(parser.failed).toBe(true);

    expect(parser.push('{"reply":"Hi"}')).toBe('');
    expect(parser.push('')).toBe('');
  });

  it('un JSON cortado a medias emite lo que llegó y no falla (el texto completo lo valida quien llama)', () => {
    const cut = JSON_TEXT.slice(0, JSON_TEXT.indexOf('gym') + 3);
    const { text, parser } = feed(fixedChunks(cut, 4));

    expect(REPLY.startsWith(text)).toBe(true);
    expect(text.endsWith('gym')).toBe(true);
    expect(parser.done).toBe(false);
    expect(parser.failed).toBe(false);
  });
});
