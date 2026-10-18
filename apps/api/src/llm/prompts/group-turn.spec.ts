import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { Level } from '../config.js';
import { GroupTurnOutput } from '../schemas.js';
import {
  buildGroupTurnMessages,
  minLevel,
  quietParticipants,
  type GroupPromptMessage,
  type GroupTrigger,
  type GroupTurnPromptInput,
} from './group-turn.js';

const MESSAGES: GroupPromptMessage[] = [
  { id: 1, authorName: 'Fluent', role: 'tutor', locale: 'es', text: 'Hi all! Any plans for the weekend?' },
  { id: 2, authorName: 'Bea', role: 'user', locale: 'es', text: 'I will cook paella.' },
  { id: 3, authorName: 'Ana', role: 'user', locale: 'es', text: 'I go to the mountain.' },
  { id: 4, authorName: 'Lucas', role: 'user', locale: 'pt-BR', text: 'Me too, I go with my brother.' },
  { id: 5, authorName: 'Ana', role: 'user', locale: 'es', text: 'Which mountain you go?' },
  { id: 6, authorName: '', role: 'system', locale: 'es', text: 'Bea is back.' },
  { id: 7, authorName: 'Lucas', role: 'user', locale: 'pt-BR', text: 'Serra do Mar, is very beautiful.' },
];

const INPUT: GroupTurnPromptInput = {
  scenario: { kind: 'free_topic', topic: 'weekend plans', promptTopic: 'weekend plans' },
  messages: MESSAGES,
  minLevel: 'A2',
  quietParticipants: ['Bea'],
  trigger: 'every_n',
};

describe('quietParticipants', () => {
  it('marca a quien no escribió entre los últimos 4 mensajes de usuario', () => {
    expect(quietParticipants(MESSAGES, ['Ana', 'Lucas', 'Bea'])).toEqual(['Bea']);
  });

  it('ignora tutor y sistema, y sin mensajes todos están callados', () => {
    expect(quietParticipants(MESSAGES.slice(0, 1), ['Ana', 'Bea'])).toEqual(['Ana', 'Bea']);
  });
});

describe('minLevel', () => {
  it('devuelve el CEFR más bajo', () => {
    expect(minLevel(['B2', 'A2', 'B1'])).toBe('A2');
    expect(minLevel(['B2', 'B1'])).toBe('B1');
    expect(minLevel(['B2'])).toBe('B2');
  });
});

describe('buildGroupTurnMessages', () => {
  const TRIGGERS: GroupTrigger[] = ['open', 'mention', 'every_n', 'stall'];

  it.each(TRIGGERS)('snapshot con trigger %s, sin brief ni hechos (NFR-3)', (trigger) => {
    const messages = buildGroupTurnMessages({ ...INPUT, trigger });
    expect(messages).toMatchSnapshot();
    const all = messages.map((message) => message.content).join('\n');
    expect(all).not.toMatch(/coaching notes|things you know|\bbrief\b|\bfacts\b/i);
  });

  it('fija techo de vocabulario, moderador, callados, ids y locale de la nota', () => {
    const [system, user] = buildGroupTurnMessages(INPUT);
    expect(system?.content).toContain('moderating a conversation between a group of friends');
    expect(system?.content).toContain('Never use vocabulary or grammar above B1');
    expect(system?.content).toContain('<datos>Bea</datos>');
    expect(system?.content).toContain('Never invent or change an id');
    expect(user?.content).toContain('#4 user Lucas (note language: Brazilian Portuguese)');
    expect(user?.content).toContain('#1 tutor (you)');
  });

  it('open saluda y stall reanima', () => {
    expect(buildGroupTurnMessages({ ...INPUT, trigger: 'open' })[0]?.content).toContain('greet the group');
    expect(buildGroupTurnMessages({ ...INPUT, trigger: 'stall' })[0]?.content).toContain('revive it');
  });
});

describe('GroupTurnOutput', () => {
  it('acepta messageId y rechaza más de 6 correcciones', () => {
    const correction = { messageId: 3, original: 'I go', corrected: 'I went', category: 'past_simple', note: 'x' };
    expect(GroupTurnOutput.parse({ reply: 'Nice!', corrections: [correction] }).corrections[0]?.messageId).toBe(3);
    expect(GroupTurnOutput.safeParse({ reply: 'Nice!', corrections: Array(7).fill(correction) }).success).toBe(false);
  });
});

interface GroupBenchCase {
  id: string;
  scenario: GroupTurnPromptInput['scenario'];
  levels: Level[];
  participants: string[];
  trigger: GroupTrigger;
  messages: GroupPromptMessage[];
  expect: { maxVocabLevel: string; bannedWords: string[] };
}

const BENCH = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../../fixtures/bench/group-turns.json', import.meta.url)),
    'utf-8',
  ),
) as GroupBenchCase[];

describe('fixtures/bench/group-turns.json (FR-13)', () => {
  it.each(BENCH)('$id: A2 + B2 limita el vocabulario a B1', (bench) => {
    expect(bench.levels).toEqual(expect.arrayContaining(['A2', 'B2']));
    expect(bench.expect.maxVocabLevel).toBe('B1');
    const [system] = buildGroupTurnMessages({
      scenario: bench.scenario,
      messages: bench.messages,
      minLevel: minLevel(bench.levels),
      quietParticipants: quietParticipants(bench.messages, bench.participants),
      trigger: bench.trigger,
    });
    expect(system?.content).toContain('Never use vocabulary or grammar above B1');
  });
});
