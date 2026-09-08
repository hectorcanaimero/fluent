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

  it('fails when happens_on has an invalid date format', () => {
    const result = BriefOutput.safeParse({
      brief: 'Keep practicing past simple.',
      facts: [{ text: 'Learner likes hiking.', happens_on: '03/11/2026' }],
    });
    expect(result.success).toBe(false);
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
