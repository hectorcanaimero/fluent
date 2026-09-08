import { pickChallenges, type CandidateSession } from './challenge-picker.js';

const NOW = new Date('2026-09-09T12:00:00.000Z');

function session(overrides: Partial<CandidateSession> & Pick<CandidateSession, 'userId'>): CandidateSession {
  return {
    sessionId: `session-${overrides.userId}-${Math.random().toString(36).slice(2, 6)}`,
    displayName: `User ${overrides.userId}`,
    topic: 'travel',
    kind: 'free_topic',
    endedAt: NOW.toISOString(),
    xpEarned: 60,
    ...overrides,
  };
}

function daysAgoIso(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe('pickChallenges', () => {
  it('excludes the requesting user\'s own sessions', () => {
    const sessions = [session({ userId: 'me', sessionId: 's-self' })];

    const result = pickChallenges(sessions, {
      requestingUserId: 'me',
      practicedTopics: new Set(),
      now: NOW,
    });

    expect(result).toEqual([]);
  });

  it('excludes sessions with xpEarned <= 0 (not "valid")', () => {
    const sessions = [session({ userId: 'friend-1', xpEarned: 0, sessionId: 's-no-xp' })];

    const result = pickChallenges(sessions, {
      requestingUserId: 'me',
      practicedTopics: new Set(),
      now: NOW,
    });

    expect(result).toEqual([]);
  });

  it('excludes sessions ended more than 7 days ago', () => {
    const sessions = [
      session({ userId: 'friend-1', endedAt: daysAgoIso(8), sessionId: 's-old' }),
    ];

    const result = pickChallenges(sessions, {
      requestingUserId: 'me',
      practicedTopics: new Set(),
      now: NOW,
    });

    expect(result).toEqual([]);
  });

  it('a session ended exactly 7 days ago is still within the window (boundary)', () => {
    const sessions = [
      session({ userId: 'friend-1', endedAt: daysAgoIso(7), sessionId: 's-boundary', topic: 'movies' }),
    ];

    const result = pickChallenges(sessions, {
      requestingUserId: 'me',
      practicedTopics: new Set(),
      now: NOW,
    });

    expect(result).toHaveLength(1);
    expect(result[0].sessionId).toBe('s-boundary');
  });

  it('excludes topics the requesting user already practiced in the last 14 days', () => {
    const sessions = [
      session({ userId: 'friend-1', topic: 'travel', sessionId: 's-practiced' }),
    ];

    const result = pickChallenges(sessions, {
      requestingUserId: 'me',
      practicedTopics: new Set(['travel']),
      now: NOW,
    });

    expect(result).toEqual([]);
  });

  it('picks at most one challenge per member: the most recent eligible session', () => {
    const sessions = [
      session({ userId: 'friend-1', topic: 'economy', endedAt: daysAgoIso(1), sessionId: 's-recent' }),
      session({ userId: 'friend-1', topic: 'sports', endedAt: daysAgoIso(3), sessionId: 's-older' }),
    ];

    const result = pickChallenges(sessions, {
      requestingUserId: 'me',
      practicedTopics: new Set(),
      now: NOW,
    });

    expect(result).toHaveLength(1);
    expect(result[0].sessionId).toBe('s-recent');
  });

  it('caps the total at 3 (MAX_CHALLENGES), most recent members first', () => {
    const sessions = [
      session({ userId: 'friend-1', endedAt: daysAgoIso(1), topic: 'a', sessionId: 's1' }),
      session({ userId: 'friend-2', endedAt: daysAgoIso(2), topic: 'b', sessionId: 's2' }),
      session({ userId: 'friend-3', endedAt: daysAgoIso(3), topic: 'c', sessionId: 's3' }),
      session({ userId: 'friend-4', endedAt: daysAgoIso(4), topic: 'd', sessionId: 's4' }),
    ];

    const result = pickChallenges(sessions, {
      requestingUserId: 'me',
      practicedTopics: new Set(),
      now: NOW,
    });

    expect(result).toHaveLength(3);
    expect(result.map((c) => c.fromUserId)).toEqual(['friend-1', 'friend-2', 'friend-3']);
  });

  it('applies every rule together (integration of the pure function)', () => {
    const sessions = [
      session({ userId: 'me', sessionId: 's-own' }), // excluded: own
      session({ userId: 'friend-1', xpEarned: 0, sessionId: 's-no-xp' }), // excluded: no xp
      session({ userId: 'friend-2', endedAt: daysAgoIso(10), sessionId: 's-old' }), // excluded: too old
      session({ userId: 'friend-3', topic: 'travel', sessionId: 's-practiced' }), // excluded: practiced
      session({ userId: 'friend-4', topic: 'economy', sessionId: 's-good' }), // kept
    ];

    const result = pickChallenges(sessions, {
      requestingUserId: 'me',
      practicedTopics: new Set(['travel']),
      now: NOW,
    });

    expect(result).toEqual([
      {
        fromUserId: 'friend-4',
        displayName: 'User friend-4',
        topic: 'economy',
        kind: 'free_topic',
        sessionId: 's-good',
      },
    ]);
  });
});
