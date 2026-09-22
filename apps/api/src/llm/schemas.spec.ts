import {
  CATEGORIES,
  Correction,
  TurnOutput,
  BriefOutput,
  WeeklyOutput,
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
