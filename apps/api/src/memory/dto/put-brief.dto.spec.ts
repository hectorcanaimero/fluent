import { validate } from 'class-validator';
import { BRIEF_TEXT_MAX_LENGTH, PutBriefDto } from './put-brief.dto.js';

function makeDto(text: string): PutBriefDto {
  const dto = new PutBriefDto();
  dto.text = text;
  return dto;
}

describe('PutBriefDto', () => {
  it(`accepts text at exactly ${BRIEF_TEXT_MAX_LENGTH} characters`, async () => {
    const errors = await validate(makeDto('a'.repeat(BRIEF_TEXT_MAX_LENGTH)));
    expect(errors).toEqual([]);
  });

  it(`rejects text longer than ${BRIEF_TEXT_MAX_LENGTH} characters -> VALIDATION`, async () => {
    const errors = await validate(makeDto('a'.repeat(BRIEF_TEXT_MAX_LENGTH + 1)));
    expect(errors.some((e) => e.property === 'text')).toBe(true);
  });

  it('accepts a short, non-empty text', async () => {
    const errors = await validate(makeDto('Keep practicing past simple.'));
    expect(errors).toEqual([]);
  });

  it('rejects an empty text (CHECK char_length BETWEEN 1 AND 600, SPEC-01 §2.10)', async () => {
    const errors = await validate(makeDto(''));
    expect(errors.some((e) => e.property === 'text')).toBe(true);
  });
});
