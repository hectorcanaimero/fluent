import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { extractFirstJsonObject, parseWithSchema } from './json.js';
import { TurnOutput, BriefOutput, WeeklyOutput } from './schemas.js';

type Outcome = 'ok' | 'no_json' | 'schema';

interface ExpectedEntry {
  schema: 'turn' | 'brief' | 'weekly';
  outcome: Outcome;
  data?: unknown;
}

const expectedPath = fileURLToPath(
  new URL('../../fixtures/llm/expected.json', import.meta.url),
);
const expected = JSON.parse(readFileSync(expectedPath, 'utf-8')) as Record<
  string,
  ExpectedEntry
>;

const schemaByName = {
  turn: TurnOutput,
  brief: BriefOutput,
  weekly: WeeklyOutput,
};

describe('parseWithSchema against real-world fixtures', () => {
  for (const [fileName, entry] of Object.entries(expected)) {
    it(`${fileName} -> ${entry.outcome}`, () => {
      const fixturePath = fileURLToPath(
        new URL(`../../fixtures/llm/${fileName}`, import.meta.url),
      );
      const raw = readFileSync(fixturePath, 'utf-8');
      const schema = schemaByName[entry.schema];
      const result = parseWithSchema(raw, schema);

      if (entry.outcome === 'ok') {
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.data).toEqual(entry.data);
        }
      } else {
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toBe(entry.outcome);
        }
      }
    });
  }
});

describe('extractFirstJsonObject', () => {
  it('ignores braces inside string values', () => {
    const text = '{"note": "usa {the} articulo", "value": 1}';
    expect(extractFirstJsonObject(text)).toEqual({
      note: 'usa {the} articulo',
      value: 1,
    });
  });

  it('respects escaped quotes and backslashes inside strings', () => {
    const text = String.raw`{"text": "she said \"hi {there}\" and left a \\ mark"}`;
    expect(extractFirstJsonObject(text)).toEqual({
      text: 'she said "hi {there}" and left a \\ mark',
    });
  });

  it('parses nested objects with balanced braces', () => {
    const text = '{"outer": {"inner": {"value": 42}}}';
    expect(extractFirstJsonObject(text)).toEqual({
      outer: { inner: { value: 42 } },
    });
  });

  it('returns null for empty or whitespace-only text', () => {
    expect(extractFirstJsonObject('')).toBeNull();
    expect(extractFirstJsonObject('   \n\t  ')).toBeNull();
  });

  it('returns null when there is no JSON object at all', () => {
    expect(extractFirstJsonObject('sorry, I cannot help with that.')).toBeNull();
  });

  it('skips a stray brace in the prose and finds the real object', () => {
    const text = 'Here is {your} answer:\n{"reply": "Hi there!", "corrections": []}';
    expect(extractFirstJsonObject(text)).toEqual({
      reply: 'Hi there!',
      corrections: [],
    });
  });

  it('returns null when braces never balance', () => {
    expect(extractFirstJsonObject('{"reply": "unterminated')).toBeNull();
  });
});
