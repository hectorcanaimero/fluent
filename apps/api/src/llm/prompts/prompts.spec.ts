import { HISTORY_TURNS, HISTORY_TURN_CHARS } from '../config.js';
import { CATEGORIES } from '../schemas.js';
import { buildBriefMessages, buildBriefUserPrompt } from './brief.js';
import { PROMPT_VERSION } from './index.js';
import { languageForLocale } from './languages.js';
import {
  formatTranscript,
  truncateHistory,
  truncateTranscript,
  truncateUserMessage,
  type HistoryTurn,
} from './truncate.js';
import { OPENING_USER_MESSAGE, buildTurnMessages, buildTurnSystemPrompt } from './turn.js';
import { buildWeeklyMessages, buildWeeklyUserPrompt } from './weekly.js';

const HISTORY: HistoryTurn[] = [
  { role: 'tutor', text: 'Hi Marta! What did you do last weekend?' },
  { role: 'user', text: 'I go to the mountain with my brother.' },
  { role: 'tutor', text: 'That sounds great! Which mountain was it?' },
  { role: 'user', text: 'Montseny, is near Barcelona.' },
];

const TURN_INPUT = {
  locale: 'es' as const,
  level: 'B1' as const,
  kind: 'free_topic' as const,
  topic: 'weekend plans',
  brief: 'Push past simple. Reinforce travel vocabulary. Enjoys hiking and food.',
  facts: [
    'The learner works as a nurse in Valencia.',
    'The learner has a brother who lives in Madrid.',
    'The learner is training for a half marathon.',
    'This fourth fact must never reach the prompt.',
  ],
  history: HISTORY,
  userMessage: 'We walk a lot and after we eat a paella in a restaurant.',
};

describe('buildTurnSystemPrompt', () => {
  it('genera el prompt de turno libre tal cual SPEC-03 §4.1', () => {
    expect(buildTurnSystemPrompt(TURN_INPUT)).toMatchSnapshot();
  });

  it('genera la apertura de roleplay con callback y fecha', () => {
    expect(
      buildTurnSystemPrompt({
        locale: 'pt-BR',
        level: 'A2',
        kind: 'roleplay',
        roleplay: {
          role: 'a check-in agent at Barcelona airport',
          situation: 'The learner has just missed a connecting flight to Lisbon.',
        },
        isFirstTurn: true,
        callbackFact: {
          text: 'The learner is planning a trip to Japan.',
          happensOn: '2026-11-03',
        },
      }),
    ).toMatchSnapshot();
  });

  it('genera la apertura de noticias sin callback', () => {
    expect(
      buildTurnSystemPrompt({
        locale: 'es',
        level: 'B2',
        kind: 'news',
        news: {
          title: 'Spain approves a four-day working week trial',
          summary: 'The pilot covers 200 companies and runs for one year.',
        },
        isFirstTurn: true,
      }),
    ).toMatchSnapshot();
  });

  it('genera el bloque de boss battle', () => {
    expect(
      buildTurnSystemPrompt({
        locale: 'es',
        level: 'B2',
        kind: 'boss',
        topic: 'whether universal basic income would help or hurt the economy',
      }),
    ).toMatchSnapshot();
  });

  it('deriva native_language y note_language del locale', () => {
    expect(languageForLocale('es')).toBe('Spanish');
    expect(languageForLocale('pt-BR')).toBe('Brazilian Portuguese');

    const es = buildTurnSystemPrompt(TURN_INPUT);
    expect(es).toContain('for a Spanish speaker');
    expect(es).toContain('"note" (in Spanish, max 140 characters, one idea)');

    const pt = buildTurnSystemPrompt({ ...TURN_INPUT, locale: 'pt-BR' });
    expect(pt).toContain('for a Brazilian Portuguese speaker');
    expect(pt).toContain('"note" (in Brazilian Portuguese, max 140 characters, one idea)');
  });

  it('lista las 14 categorías del catálogo', () => {
    expect(buildTurnSystemPrompt(TURN_INPUT)).toContain(`one of: ${CATEGORIES.join(', ')}`);
  });

  it('usa los textos por defecto sin brief ni hechos', () => {
    const prompt = buildTurnSystemPrompt({
      locale: 'es',
      level: 'A2',
      kind: 'free_topic',
      topic: 'food',
    });
    expect(prompt).toContain('Coaching notes about this learner (follow them):\nNone yet.');
    expect(prompt).toContain(
      'Things you know about the learner (use naturally, never list them):\nNothing yet.',
    );
  });

  it('solo añade la regla 6 en el primer turno', () => {
    expect(buildTurnSystemPrompt(TURN_INPUT)).not.toContain('\n6.');
    expect(
      buildTurnSystemPrompt({ ...TURN_INPUT, isFirstTurn: true }),
    ).toContain('6. Open with a warm one-sentence greeting and the first question about the topic.');
  });

  it('omite la fecha del callback cuando no hay happens_on', () => {
    const prompt = buildTurnSystemPrompt({
      ...TURN_INPUT,
      isFirstTurn: true,
      callbackFact: { text: 'The learner adopted a dog.', happensOn: null },
    });
    expect(prompt).toContain(
      '6. Open by asking casually about this: "The learner adopted a dog.". One sentence, then move to the session topic.',
    );
    expect(prompt).not.toContain('scheduled for');
  });

  it('usa como mucho 3 hechos y recorta el brief a 600 caracteres', () => {
    const prompt = buildTurnSystemPrompt({ ...TURN_INPUT, brief: 'x'.repeat(900) });
    expect(prompt).not.toContain('This fourth fact must never reach the prompt.');
    expect(prompt).toContain('x'.repeat(600));
    expect(prompt).not.toContain('x'.repeat(601));
  });
});

describe('buildTurnMessages', () => {
  it('monta system + historial + mensaje del aprendiz', () => {
    const messages = buildTurnMessages(TURN_INPUT);
    expect(messages.map((m) => m.role)).toEqual([
      'system',
      'assistant',
      'user',
      'assistant',
      'user',
      'user',
    ]);
    expect(messages.at(-1)?.content).toBe(
      'We walk a lot and after we eat a paella in a restaurant.',
    );
  });

  it('en la apertura manda el mensaje fijo de SPEC-04 §3', () => {
    const messages = buildTurnMessages({
      locale: 'es',
      level: 'B1',
      kind: 'free_topic',
      topic: 'music',
      isFirstTurn: true,
    });
    expect(messages).toHaveLength(2);
    expect(messages[1]).toEqual({ role: 'user', content: OPENING_USER_MESSAGE });
  });

  it('el historial nunca supera 8 turnos ni 600 caracteres por turno', () => {
    const long: HistoryTurn[] = Array.from({ length: 30 }, (_, i) => ({
      role: i % 2 === 0 ? ('tutor' as const) : ('user' as const),
      text: `${i}-${'a'.repeat(2000)}`,
    }));

    const messages = buildTurnMessages({ ...TURN_INPUT, history: long });
    const historyMessages = messages.slice(1, -1);

    expect(historyMessages).toHaveLength(HISTORY_TURNS);
    for (const message of historyMessages) {
      expect(message.content.length).toBeLessThanOrEqual(HISTORY_TURN_CHARS);
    }
    // Se conservan los ÚLTIMOS turnos, no los primeros.
    expect(historyMessages[0]?.content.startsWith('22-')).toBe(true);
    expect(historyMessages.at(-1)?.content.startsWith('29-')).toBe(true);
  });

  it('recorta el mensaje del aprendiz a 1 000 caracteres', () => {
    const messages = buildTurnMessages({ ...TURN_INPUT, userMessage: 'b'.repeat(1500) });
    expect(messages.at(-1)?.content).toHaveLength(1000);
  });
});

describe('truncados de SPEC-03 §3', () => {
  it('truncateHistory no toca un historial corto', () => {
    expect(truncateHistory(HISTORY)).toEqual(HISTORY);
  });

  it('truncateUserMessage respeta el texto corto', () => {
    expect(truncateUserMessage('hola')).toBe('hola');
  });

  it('truncateTranscript se queda con el final y no corta a mitad de línea', () => {
    const transcript = formatTranscript(HISTORY);
    expect(truncateTranscript(transcript)).toBe(transcript);

    const long = Array.from({ length: 400 }, (_, i) => `Learner: mensaje número ${i}`).join('\n');
    const cut = truncateTranscript(long, 200);
    expect(cut.length).toBeLessThanOrEqual(200);
    expect(cut.startsWith('Learner: ')).toBe(true);
    expect(long.endsWith(cut)).toBe(true);
  });

  it('formatTranscript usa las etiquetas Learner y Tutor', () => {
    expect(formatTranscript(HISTORY.slice(0, 2))).toBe(
      'Tutor: Hi Marta! What did you do last weekend?\nLearner: I go to the mountain with my brother.',
    );
  });
});

describe('buildBriefMessages', () => {
  const BRIEF_INPUT = {
    locale: 'es' as const,
    level: 'B1' as const,
    previousBrief: 'Push past simple. Reinforce travel vocabulary.',
    knownFacts: ['The learner works as a nurse in Valencia.'],
    kind: 'free_topic' as const,
    topic: 'weekend plans',
    turns: HISTORY,
  };

  it('genera system y user tal cual SPEC-03 §4.2', () => {
    expect(buildBriefMessages(BRIEF_INPUT)).toMatchSnapshot();
  });

  it('deriva native_language del locale igual que el prompt de turno', () => {
    expect(buildBriefMessages(BRIEF_INPUT)[0]?.content).toContain(
      'session of a Spanish-speaking learner (level B1)',
    );
    expect(
      buildBriefMessages({ ...BRIEF_INPUT, locale: 'pt-BR', level: 'A2' })[0]?.content,
    ).toContain('session of a Brazilian Portuguese-speaking learner (level A2)');
  });

  it('usa None cuando no hay notas ni hechos previos', () => {
    const user = buildBriefUserPrompt({ ...BRIEF_INPUT, previousBrief: null, knownFacts: [] });
    expect(user.startsWith('Previous notes: None\nKnown facts: None\n')).toBe(true);
  });

  it('recorta el transcript a los últimos 6 000 caracteres', () => {
    const turns: HistoryTurn[] = Array.from({ length: 500 }, (_, i) => ({
      role: i % 2 === 0 ? ('user' as const) : ('tutor' as const),
      text: `mensaje ${i} ${'z'.repeat(50)}`,
    }));
    const user = buildBriefUserPrompt({ ...BRIEF_INPUT, turns });
    const transcript = user.split('Session (free_topic: weekend plans):\n')[1] ?? '';
    expect(transcript.length).toBeLessThanOrEqual(6000);
    expect(transcript).toContain('mensaje 499');
    expect(transcript).not.toContain('mensaje 0 ');
  });
});

describe('buildWeeklyMessages', () => {
  const WEEKLY_INPUT = {
    ownerLocale: 'es' as const,
    members: [
      { name: 'Marta', xpWeek: 420, sessionsWeek: 5, streak: 12, topTopics: ['travel', 'food'] },
      { name: 'Hugo', xpWeek: 180, sessionsWeek: 2, streak: 3, topTopics: ['football'] },
    ],
    groupStreak: 4,
    weekStart: '2026-09-07',
  };

  it('genera system y user tal cual SPEC-03 §4.3', () => {
    expect(buildWeeklyMessages(WEEKLY_INPUT)).toMatchSnapshot();
  });

  it('el user es JSON con members, groupStreak y weekStart', () => {
    const parsed = JSON.parse(buildWeeklyUserPrompt(WEEKLY_INPUT)) as Record<string, unknown>;
    expect(Object.keys(parsed)).toEqual(['members', 'groupStreak', 'weekStart']);
    expect(parsed.groupStreak).toBe(4);
  });

  it('usa el idioma del owner del grupo', () => {
    expect(buildWeeklyMessages(WEEKLY_INPUT)[0]?.content).toContain('weekly recap in Spanish');
    expect(
      buildWeeklyMessages({ ...WEEKLY_INPUT, ownerLocale: 'pt-BR' })[0]?.content,
    ).toContain('weekly recap in Brazilian Portuguese');
  });
});

describe('PROMPT_VERSION', () => {
  it('está definida y es una cadena no vacía', () => {
    expect(typeof PROMPT_VERSION).toBe('string');
    expect(PROMPT_VERSION.length).toBeGreaterThan(0);
  });
});
