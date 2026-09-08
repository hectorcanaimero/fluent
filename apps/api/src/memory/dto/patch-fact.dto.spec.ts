import { validate } from 'class-validator';
import { FACT_TEXT_MAX_LENGTH, PatchFactDto } from './patch-fact.dto.js';

function makeDto(fields: Partial<PatchFactDto>): PatchFactDto {
  const dto = new PatchFactDto();
  Object.assign(dto, fields);
  return dto;
}

describe('PatchFactDto', () => {
  it('accepts status only', async () => {
    const errors = await validate(makeDto({ status: 'confirmed' }));
    expect(errors).toEqual([]);
  });

  it('accepts text only (inline edit without changing status, SPEC-06 §4.5)', async () => {
    const errors = await validate(makeDto({ text: 'Ana likes hiking.' }));
    expect(errors).toEqual([]);
  });

  it('accepts status and text together', async () => {
    const errors = await validate(makeDto({ status: 'dismissed', text: 'Ana likes hiking.' }));
    expect(errors).toEqual([]);
  });

  it('accepts neither field set (DTO-level; MemoryService rejects this, PEND-41)', async () => {
    const errors = await validate(makeDto({}));
    expect(errors).toEqual([]);
  });

  it('rejects a status outside confirmed/dismissed (e.g. "pending")', async () => {
    const errors = await validate(makeDto({ status: 'pending' as never }));
    expect(errors.some((e) => e.property === 'status')).toBe(true);
  });

  it(`accepts text at exactly ${FACT_TEXT_MAX_LENGTH} characters`, async () => {
    const errors = await validate(makeDto({ text: 'a'.repeat(FACT_TEXT_MAX_LENGTH) }));
    expect(errors).toEqual([]);
  });

  it(`rejects text longer than ${FACT_TEXT_MAX_LENGTH} characters`, async () => {
    const errors = await validate(makeDto({ text: 'a'.repeat(FACT_TEXT_MAX_LENGTH + 1) }));
    expect(errors.some((e) => e.property === 'text')).toBe(true);
  });

  it('rejects an empty text', async () => {
    const errors = await validate(makeDto({ text: '' }));
    expect(errors.some((e) => e.property === 'text')).toBe(true);
  });
});
