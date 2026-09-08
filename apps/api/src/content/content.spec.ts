import {
  INTERESTS,
  ROLEPLAYS,
  TOPICS,
  BOSS_TOPICS,
  FEEDS,
  InterestSchema,
  RoleplaySchema,
  TopicSchema,
  BossTopicSchema,
  FeedSchema,
} from './index.js';

describe('Content - Interests', () => {
  it('should have exactly 24 interests', () => {
    expect(INTERESTS).toHaveLength(24);
  });

  it('should have unique IDs', () => {
    const ids = INTERESTS.map((i: typeof INTERESTS[number]) => i.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should validate all interests against schema', () => {
    expect(() => {
      INTERESTS.forEach((interest: typeof INTERESTS[number]) => {
        InterestSchema.parse(interest);
      });
    }).not.toThrow();
  });

  it('should have valid tags', () => {
    INTERESTS.forEach((interest: typeof INTERESTS[number]) => {
      expect(interest.tags.length).toBeGreaterThanOrEqual(2);
      expect(interest.tags.length).toBeLessThanOrEqual(5);
      // Verify no duplicate tags within an interest
      const uniqueTags = new Set(interest.tags);
      expect(uniqueTags.size).toBe(interest.tags.length);
    });
  });

  it('should have both Spanish and Portuguese labels', () => {
    INTERESTS.forEach((interest: typeof INTERESTS[number]) => {
      expect(interest.label_es).toBeTruthy();
      expect(interest.label_pt).toBeTruthy();
    });
  });
});

describe('Content - Roleplays', () => {
  it('should have exactly 30 roleplays', () => {
    expect(ROLEPLAYS).toHaveLength(30);
  });

  it('should have unique IDs', () => {
    const ids = ROLEPLAYS.map((r: typeof ROLEPLAYS[number]) => r.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should validate all roleplays against schema', () => {
    expect(() => {
      ROLEPLAYS.forEach((roleplay: typeof ROLEPLAYS[number]) => {
        RoleplaySchema.parse(roleplay);
      });
    }).not.toThrow();
  });

  it('should have valid level_min', () => {
    ROLEPLAYS.forEach((roleplay: typeof ROLEPLAYS[number]) => {
      expect(['A2', 'B1', 'B2']).toContain(roleplay.level_min);
    });
  });

  it('should have at least 8 A2, 10 B1, and 5 B2', () => {
    const a2Count = ROLEPLAYS.filter((r) => r.level_min === 'A2').length;
    const b1Count = ROLEPLAYS.filter((r) => r.level_min === 'B1').length;
    const b2Count = ROLEPLAYS.filter((r) => r.level_min === 'B2').length;

    expect(a2Count).toBeGreaterThanOrEqual(8);
    expect(b1Count).toBeGreaterThanOrEqual(10);
    expect(b2Count).toBeGreaterThanOrEqual(5);
  });

  it('should include the 10 mandatory scenarios', () => {
    const mandatorySlugs = [
      'barcelona-airport-missed-flight',
      'remote-job-interview',
      'return-defective-product',
      'ask-directions-london',
      'restaurant-reservation-time-change',
      'explain-bug-colleague',
      'negotiate-rent',
      'doctor-appointment',
      'hotel-check-in-overbooking',
      'introduce-friend-at-party',
    ];

    const roleplayIds = ROLEPLAYS.map((r) => r.id);
    mandatorySlugs.forEach((slug) => {
      expect(roleplayIds).toContain(slug);
    });
  });
});

describe('Content - Topics', () => {
  it('should have exactly 60 topics', () => {
    expect(TOPICS).toHaveLength(60);
  });

  it('should have unique IDs', () => {
    const ids = TOPICS.map((t: typeof TOPICS[number]) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should validate all topics against schema', () => {
    expect(() => {
      TOPICS.forEach((topic: typeof TOPICS[number]) => {
        TopicSchema.parse(topic);
      });
    }).not.toThrow();
  });

  it('should have valid level_min', () => {
    TOPICS.forEach((topic: typeof TOPICS[number]) => {
      expect(['A2', 'B1', 'B2']).toContain(topic.level_min);
    });
  });

  it('should have valid tags (1-3 each)', () => {
    TOPICS.forEach((topic) => {
      expect(topic.tags.length).toBeGreaterThanOrEqual(1);
      expect(topic.tags.length).toBeLessThanOrEqual(3);
    });
  });

  it('should have all tags existing in interests', () => {
    const allInterestTags = new Set<string>();
    INTERESTS.forEach((interest: typeof INTERESTS[number]) => {
      interest.tags.forEach((tag: string) => allInterestTags.add(tag));
    });

    TOPICS.forEach((topic: typeof TOPICS[number]) => {
      topic.tags.forEach((tag: string) => {
        expect(allInterestTags.has(tag)).toBe(true);
      });
    });
  });

  it('should have at least 2 topics per interest', () => {
    const topicsByTag: Record<string, number> = {};

    INTERESTS.forEach((interest: typeof INTERESTS[number]) => {
      interest.tags.forEach((tag: string) => {
        topicsByTag[tag] = 0;
      });
    });

    TOPICS.forEach((topic: typeof TOPICS[number]) => {
      topic.tags.forEach((tag: string) => {
        topicsByTag[tag] = (topicsByTag[tag] || 0) + 1;
      });
    });

    INTERESTS.forEach((interest: typeof INTERESTS[number]) => {
      const minTopicsForInterest = Math.min(
        ...interest.tags.map((tag: string) => topicsByTag[tag] || 0),
      );
      expect(minTopicsForInterest).toBeGreaterThanOrEqual(2);
    });
  });
});

describe('Content - Boss Topics', () => {
  it('should have exactly 40 boss topics', () => {
    expect(BOSS_TOPICS).toHaveLength(40);
  });

  it('should have unique IDs', () => {
    const ids = BOSS_TOPICS.map((bt: typeof BOSS_TOPICS[number]) => bt.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should validate all boss topics against schema', () => {
    expect(() => {
      BOSS_TOPICS.forEach((bossTopic: typeof BOSS_TOPICS[number]) => {
        BossTopicSchema.parse(bossTopic);
      });
    }).not.toThrow();
  });

  it('should have valid level_min (B1 or B2 only)', () => {
    BOSS_TOPICS.forEach((bossTopic: typeof BOSS_TOPICS[number]) => {
      expect(['B1', 'B2']).toContain(bossTopic.level_min);
    });
  });

  it('should have majority B2 topics', () => {
    const b2Count = BOSS_TOPICS.filter((bt) => bt.level_min === 'B2').length;
    expect(b2Count).toBeGreaterThan(20);
  });
});

describe('Content - Feeds', () => {
  it('should have exactly 8 feeds', () => {
    expect(FEEDS).toHaveLength(8);
  });

  it('should validate all feeds against schema', () => {
    expect(() => {
      FEEDS.forEach((feed: typeof FEEDS[number]) => {
        FeedSchema.parse(feed);
      });
    }).not.toThrow();
  });

  it('should always have lang "en"', () => {
    FEEDS.forEach((feed: typeof FEEDS[number]) => {
      expect(feed.lang).toBe('en');
    });
  });

  it('should have URLs with valid URL shape', () => {
    FEEDS.forEach((feed: typeof FEEDS[number]) => {
      expect(() => new URL(feed.url)).not.toThrow();
    });
  });

  it('should have unique names', () => {
    const names = FEEDS.map((f: typeof FEEDS[number]) => f.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it('should have unique URLs', () => {
    const urls = FEEDS.map((f: typeof FEEDS[number]) => f.url);
    const uniqueUrls = new Set(urls);
    expect(uniqueUrls.size).toBe(urls.length);
  });

  it('should be frozen', () => {
    expect(() => {
      (FEEDS as any).push({});
    }).toThrow();
  });

  it('should include the 8 sources of SPEC-05 §3', () => {
    const names = FEEDS.map((f: typeof FEEDS[number]) => f.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'BBC World',
        'BBC Technology',
        'The Guardian Football',
        'Ars Technica',
        'NPR Science',
        'BBC Sport Football',
        'The Verge',
        'NASA Breaking News',
      ]),
    );
  });
});

describe('Content - Integration', () => {
  it('should have all data loaded and frozen', () => {
    expect(INTERESTS).toBeDefined();
    expect(ROLEPLAYS).toBeDefined();
    expect(TOPICS).toBeDefined();
    expect(BOSS_TOPICS).toBeDefined();

    expect(() => {
      (INTERESTS as any).push({});
    }).toThrow();

    expect(() => {
      (ROLEPLAYS as any).push({});
    }).toThrow();

    expect(() => {
      (TOPICS as any).push({});
    }).toThrow();

    expect(() => {
      (BOSS_TOPICS as any).push({});
    }).toThrow();
  });

  it('should have no overlapping interest IDs', () => {
    const allIds = [
      ...INTERESTS.map((i: typeof INTERESTS[number]) => i.id),
      ...ROLEPLAYS.map((r: typeof ROLEPLAYS[number]) => r.id),
      ...TOPICS.map((t: typeof TOPICS[number]) => t.id),
      ...BOSS_TOPICS.map((bt: typeof BOSS_TOPICS[number]) => bt.id),
    ];

    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(allIds.length);
  });
});
