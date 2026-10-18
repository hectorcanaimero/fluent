import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { looksEnglish } from './english.js';

const vectors = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../testdata/english-vectors.json'), 'utf8'),
) as { english: string[]; not_english: string[] };

describe('looksEnglish', () => {
  it.each(vectors.english)('accepts English: %s', (text) => {
    expect(looksEnglish(text)).toBe(true);
  });

  it.each(vectors.not_english)('rejects Portuguese/Spanish: %s', (text) => {
    expect(looksEnglish(text)).toBe(false);
  });
});
