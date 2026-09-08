import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// Esquemas
// ============================================================================

export const InterestSchema = z.object({
  id: z.string().min(1),
  label_es: z.string().min(1),
  label_pt: z.string().min(1),
  tags: z.array(z.string().min(1)).min(2).max(5),
});

export const RoleplaySchema = z.object({
  id: z.string().min(1),
  title_es: z.string().min(1),
  role: z.string().min(1),
  situation: z.string().min(1),
  level_min: z.enum(['A2', 'B1', 'B2']),
});

export const TopicSchema = z.object({
  id: z.string().min(1),
  title_es: z.string().min(1),
  prompt_en: z.string().min(1),
  tags: z.array(z.string().min(1)).min(1).max(3),
  level_min: z.enum(['A2', 'B1', 'B2']),
});

export const BossTopicSchema = z.object({
  id: z.string().min(1),
  title_es: z.string().min(1),
  prompt_en: z.string().min(1),
  level_min: z.enum(['B1', 'B2']),
});

// ============================================================================
// Tipos
// ============================================================================

export type Interest = z.infer<typeof InterestSchema>;
export type Roleplay = z.infer<typeof RoleplaySchema>;
export type Topic = z.infer<typeof TopicSchema>;
export type BossTopic = z.infer<typeof BossTopicSchema>;

// ============================================================================
// Carga
// ============================================================================

function loadJson(filename: string): unknown {
  return JSON.parse(readFileSync(join(__dirname, filename), 'utf-8'));
}

const interestsData = loadJson('interests.json');
export const INTERESTS: readonly Interest[] = Object.freeze(
  z.array(InterestSchema).parse(interestsData),
);

const rolesData = loadJson('roleplays.json');
export const ROLEPLAYS: readonly Roleplay[] = Object.freeze(
  z.array(RoleplaySchema).parse(rolesData),
);

const topicsData = loadJson('topics.json');
export const TOPICS: readonly Topic[] = Object.freeze(
  z.array(TopicSchema).parse(topicsData),
);

const bossTopicsData = loadJson('boss-topics.json');
export const BOSS_TOPICS: readonly BossTopic[] = Object.freeze(
  z.array(BossTopicSchema).parse(bossTopicsData),
);

// ============================================================================
// Funciones auxiliares
// ============================================================================

export function getInterest(id: string): Interest | undefined {
  return INTERESTS.find((i) => i.id === id);
}

export function getRoleplay(id: string): Roleplay | undefined {
  return ROLEPLAYS.find((r) => r.id === id);
}

export function getTopic(id: string): Topic | undefined {
  return TOPICS.find((t) => t.id === id);
}

export function getBossTopic(id: string): BossTopic | undefined {
  return BOSS_TOPICS.find((bt) => bt.id === id);
}
