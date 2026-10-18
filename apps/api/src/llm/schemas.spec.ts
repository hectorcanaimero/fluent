import {
  CATEGORIES,
  Correction,
  TurnOutput,
  BriefOutput,
  WeeklyOutput,
  InterviewTurnOutput,
} from './schemas.js';

describe('CATEGORIES', () => {
  it('matches the exact catalog and order from SPEC-01 §4', () => {
    expect(CATEGORIES).toEqual([
      'past_simple',
      'present_perfect',
      'articles',
      'prepositions',
      'word_order',
      'subject_verb',
      'plurals',
      'vocabulary',
      'pronunciation_hint',
      'false_friend',
      'phrasal_verb',
      'conditional',
      'modal',
      'other',
    ]);
  });
});

describe('Correction', () => {
  it('maps an unknown category to "other" via .catch', () => {
    const result = Correction.safeParse({
      original: 'I go yesterday',
      corrected: 'I went yesterday',
      category: 'some_made_up_category',
      note: 'nota',
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.category).toBe('other');
  });

  it('defaults note to an empty string when absent', () => {
    const result = Correction.safeParse({
      original: 'I go yesterday',
      corrected: 'I went yesterday',
      category: 'past_simple',
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.note).toBe('');
  });
});

describe('TurnOutput', () => {
  it('defaults corrections to [] when absent', () => {
    const result = TurnOutput.safeParse({ reply: 'Hello there!' });
    expect(result.success).toBe(true);
    expect(result.success && result.data.corrections).toEqual([]);
  });

  it('fails when there are more than 2 corrections', () => {
    const correction = {
      original: 'a',
      corrected: 'b',
      category: 'other',
      note: '',
    };
    const result = TurnOutput.safeParse({
      reply: 'Hello there!',
      corrections: [correction, correction, correction],
    });
    expect(result.success).toBe(false);
  });

  it('fails when reply is missing', () => {
    const result = TurnOutput.safeParse({ corrections: [] });
    expect(result.success).toBe(false);
  });
});

describe('BriefOutput', () => {
  it('defaults level_hint to null when absent', () => {
    const result = BriefOutput.safeParse({
      brief: 'Keep practicing past simple.',
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.level_hint).toBeNull();
  });

  it('defaults facts and recurring_errors to [] when absent', () => {
    const result = BriefOutput.safeParse({
      brief: 'Keep practicing past simple.',
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.facts).toEqual([]);
    expect(result.success && result.data.recurring_errors).toEqual([]);
  });

  it('descarta el dato con la fecha mal escrita y conserva el resto', () => {
    const parsed = BriefOutput.safeParse({
      brief: 'Keep practicing past tense.',
      facts: [
        { text: 'Works as a designer', happens_on: null },
        { text: 'Trip', happens_on: '12/05/2026' },
      ],
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.facts).toEqual([
      { text: 'Works as a designer', happens_on: null },
    ]);
  });

  it('un dato sin happens_on vale: la fecha queda en null', () => {
    const parsed = BriefOutput.safeParse({
      brief: 'Keep practicing past tense.',
      facts: [{ text: 'Supports Flamengo' }],
    });

    expect(parsed.success && parsed.data.facts).toEqual([
      { text: 'Supports Flamengo', happens_on: null },
    ]);
  });

  it('un level_hint fuera del enum no tumba el brief', () => {
    const parsed = BriefOutput.safeParse({
      brief: 'Keep practicing past tense.',
      level_hint: 'B2+',
    });

    expect(parsed.success && parsed.data.level_hint).toBe(null);
  });

  it('el brief largo se recorta a 900 caracteres', () => {
    const parsed = BriefOutput.safeParse({ brief: 'a'.repeat(1200) });

    expect(parsed.success && parsed.data.brief.length).toBe(900);
  });

  it('accepts a null happens_on', () => {
    const result = BriefOutput.safeParse({
      brief: 'Keep practicing past simple.',
      facts: [{ text: 'Learner likes hiking.', happens_on: null }],
    });
    expect(result.success).toBe(true);
  });

  it('maps unknown recurring_errors categories to "other"', () => {
    const result = BriefOutput.safeParse({
      brief: 'Keep practicing past simple.',
      recurring_errors: [{ category: 'not_a_real_category', example: 'x' }],
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.recurring_errors[0]?.category).toBe(
      'other',
    );
  });
});

describe('WeeklyOutput', () => {
  it('requires at least 50 characters of text', () => {
    const result = WeeklyOutput.safeParse({ text: 'too short' });
    expect(result.success).toBe(false);
  });

  it('accepts a valid weekly recap', () => {
    const result = WeeklyOutput.safeParse({
      text: 'A'.repeat(60),
    });
    expect(result.success).toBe(true);
  });
});

describe('InterviewTurnOutput', () => {
  const correction = { original: 'I have work there 3 years', corrected: 'I have worked there for 3 years', category: 'present_perfect', note: 'x' };
  const base = { reply: 'Thanks. Tell me about a hard bug you fixed.', questionIdx: 2, isFollowUp: false, done: false };

  it('conserva el reply con 8 correcciones y corta a 6', () => {
    const parsed = InterviewTurnOutput.parse({ ...base, corrections: Array<typeof correction>(8).fill(correction) });
    expect(parsed.reply).toBe(base.reply);
    expect(parsed.corrections).toHaveLength(6);
  });

  it('una corrección inválida se descarta sola y no tira el reply', () => {
    const parsed = InterviewTurnOutput.parse({ ...base, corrections: [{ original: '' }, correction] });
    expect(parsed.reply).toBe(base.reply);
    expect(parsed.corrections).toEqual([correction]);
    expect(InterviewTurnOutput.parse({ ...base, corrections: 'none' }).corrections).toEqual([]);
  });

  // 2026-10-18: la apertura de una entrevista salió entera en portugués. Un
  // reply que no está en inglés falla la validación, y LlmService prueba el
  // siguiente candidato (o la sesión degrada a la frase fija en inglés).
  it('un reply en portugués o español falla', () => {
    const pt = 'Olá, sou o entrevistador. Esta conversa será em português, conforme o seu idioma.';
    const es = 'Hola, soy tu entrevistador. ¿Puedes contarme sobre tu experiencia?';
    expect(InterviewTurnOutput.safeParse({ ...base, reply: pt }).success).toBe(false);
    expect(InterviewTurnOutput.safeParse({ ...base, reply: es }).success).toBe(false);
    expect(InterviewTurnOutput.safeParse({ ...base, reply: 'Great. How did you scale it in São Paulo?' }).success).toBe(true);
  });

  it('sin reply o sin questionIdx numérico sí falla', () => {
    expect(InterviewTurnOutput.safeParse({ ...base, reply: '' }).success).toBe(false);
    expect(InterviewTurnOutput.safeParse({ ...base, questionIdx: 'tres' }).success).toBe(false);
  });

  it('questionIdx tolera "3" y " #3 " y lleva 0/9 al borde', () => {
    expect(InterviewTurnOutput.parse({ ...base, questionIdx: '3' }).questionIdx).toBe(3);
    expect(InterviewTurnOutput.parse({ ...base, questionIdx: ' #3 ' }).questionIdx).toBe(3);
    expect(InterviewTurnOutput.parse({ ...base, questionIdx: 0 }).questionIdx).toBe(1);
    expect(InterviewTurnOutput.parse({ ...base, questionIdx: 9 }).questionIdx).toBe(8);
  });

  it('un reply de más de 600 se recorta en vez de fallar', () => {
    expect(InterviewTurnOutput.parse({ ...base, reply: 'a'.repeat(700) }).reply).toHaveLength(600);
  });

  it('una note de más de 140 se recorta y la corrección se conserva', () => {
    const parsed = InterviewTurnOutput.parse({ ...base, corrections: [{ ...correction, note: 'n'.repeat(200) }] });
    expect(parsed.corrections).toHaveLength(1);
    expect(parsed.corrections[0]?.note).toHaveLength(140);
    // El turno 1:1 no cambia: ahí una note larga sigue sin validar.
    expect(TurnOutput.safeParse({ reply: 'ok', corrections: [{ ...correction, note: 'n'.repeat(200) }] }).success).toBe(false);
  });
});
