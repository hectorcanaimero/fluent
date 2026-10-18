/**
 * Banco de pruebas de modelos (SPEC-03 §9, pregunta abierta 1 del PRD).
 *
 * Para cada modelo o combo de 9router lanza los 20 turnos sintéticos de nivel B1 de
 * `fixtures/bench/turns.json` (cada uno con dos errores plantados y su categoría) y
 * mide, con `generateObject` sobre el `TurnOutput`:
 *   - tasa de JSON válido,
 *   - latencia p50 y p90,
 *   - si detectó al menos 1 de los 2 errores plantados,
 *   - `prompt_tokens` que reporta 9router frente a los tokens estimados del prompt
 *     (vigila el system prompt oculto que inyecta el router, arquitectura 001).
 *
 * Criterio de SPEC-03 §9: un modelo entra en `FALLBACK_MODELS` si su tasa de JSON
 * válido es ≥ 95 % y su p90 < 8 s. El proceso termina con código 1 si algún modelo
 * probado no cumple ambos.
 *
 * Este script NO se ejecuta en CI ni en los tests: lo corre el operador con SUS
 * claves y pega la tabla resultante en la spec.
 *
 *   cd apps/api
 *   export NINEROUTER_URL=...
 *   export NINEROUTER_API_KEY=...
 *   pnpm bench:models
 *   pnpm bench:models -- --models "fluent-free,fluent-pro,ds/deepseek-v4-flash"
 *   pnpm bench:models -- --repeats 2 --concurrency 2
 *   pnpm bench:models -- --dry-run
 *
 * La clave se lee solo de `NINEROUTER_API_KEY` y nunca se imprime.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateObject, type LanguageModel } from 'ai';

import { FREE_COMBO, PRO_COMBO, PURPOSE_DEFAULTS, type SessionKind } from '../src/llm/config.js';
import { extractFirstJsonObject } from '../src/llm/json.js';
import { mapError } from '../src/llm/llm.service.js';
import { reasoningEffortFor } from '../src/llm/ninerouter-models.js';
import { createNineRouterProvider } from '../src/llm/ninerouter.provider.js';
import { buildTurnMessages } from '../src/llm/prompts/index.js';
import { CATEGORIES, TurnOutput, type Category } from '../src/llm/schemas.js';
import type { LlmCallStatus, LlmMessage } from '../src/llm/types.js';

/** SPEC-03 §9. */
const MIN_VALID_JSON_RATE = 0.95;
const MAX_P90_MS = 8000;
const DEFAULT_MODELS: readonly string[] = [FREE_COMBO, PRO_COMBO];

interface PlantedError {
  readonly category: Category;
  readonly trigger: string;
}

interface BenchTurn {
  readonly id: string;
  readonly kind: SessionKind;
  readonly topic: string;
  readonly history: ReadonlyArray<{ role: 'user' | 'tutor'; text: string }>;
  readonly userMessage: string;
  readonly planted: readonly [PlantedError, PlantedError];
}

interface TurnOutcome {
  readonly validJson: boolean;
  readonly latencyMs: number;
  readonly detectedAtLeastOne: boolean;
  readonly detectedBoth: boolean;
  readonly status: LlmCallStatus;
  readonly promptTokensEstimated: number;
  readonly promptTokensReported: number | null;
}

interface ModelReport {
  readonly model: string;
  readonly turns: number;
  readonly validJsonRate: number;
  readonly p50: number;
  readonly p90: number;
  readonly detectionRate: number;
  readonly bothRate: number;
  readonly statuses: Record<string, number>;
  readonly avgPromptTokensEstimated: number;
  readonly avgPromptTokensReported: number | null;
  readonly passes: boolean;
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** Sube directorios desde `from` hasta encontrar `relative`. */
function findUp(from: string, relative: string): string | null {
  let dir = from;
  for (let i = 0; i < 12; i++) {
    const candidate = join(dir, relative);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const HERE = dirname(fileURLToPath(import.meta.url));

function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)] ?? 0;
}

function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

/** Aproximación habitual de 4 caracteres por token: suficiente para vigilar un hidden prompt. */
function estimateTokens(messages: readonly LlmMessage[]): number {
  const chars = messages.reduce((sum, m) => sum + m.content.length, 0);
  return Math.round(chars / 4);
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúüñ ]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Se considera detectado un error plantado si el modelo devolvió una corrección de
 * su misma categoría o cuyo `original` solapa con el fragmento plantado.
 */
function detects(planted: PlantedError, corrections: TurnOutput['corrections']): boolean {
  const trigger = normalize(planted.trigger);
  return corrections.some((correction) => {
    if (correction.category === planted.category) return true;
    const original = normalize(correction.original);
    return original.includes(trigger) || trigger.includes(original);
  });
}

interface CliOptions {
  readonly models: readonly string[];
  readonly repeats: number;
  readonly concurrency: number;
  readonly dryRun: boolean;
  readonly turnsPath: string;
}

function parseArgs(argv: readonly string[]): CliOptions {
  const get = (name: string): string | undefined => {
    const index = argv.indexOf(`--${name}`);
    return index === -1 ? undefined : argv[index + 1];
  };

  const modelsArg = get('models');
  const models = modelsArg
    ? modelsArg
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    : DEFAULT_MODELS;

  const turnsArg = get('turns');
  const turnsPath = turnsArg
    ? resolve(turnsArg)
    : (findUp(HERE, 'fixtures/bench/turns.json') ??
      findUp(process.cwd(), 'fixtures/bench/turns.json') ??
      findUp(process.cwd(), 'apps/api/fixtures/bench/turns.json') ??
      '');

  return {
    models,
    repeats: Number(get('repeats') ?? 1),
    concurrency: Math.max(1, Number(get('concurrency') ?? 1)),
    dryRun: argv.includes('--dry-run'),
    turnsPath,
  };
}

function loadTurns(path: string): BenchTurn[] {
  if (!path || !existsSync(path)) {
    throw new Error(
      'No encuentro fixtures/bench/turns.json. Ejecuta el script desde apps/api o pasa --turns <ruta>.',
    );
  }
  const parsed = JSON.parse(readFileSync(path, 'utf-8')) as BenchTurn[];
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`El fichero de turnos ${path} está vacío o no es un array`);
  }
  for (const turn of parsed) {
    if (turn.planted?.length !== 2) {
      throw new Error(`El turno ${turn.id} no tiene exactamente 2 errores plantados`);
    }
    for (const planted of turn.planted) {
      if (!CATEGORIES.includes(planted.category)) {
        throw new Error(`Categoría desconocida "${planted.category}" en el turno ${turn.id}`);
      }
    }
  }
  return parsed;
}

/** Quita vallas ```json y prosa: algunos modelos las mandan incluso con `response_format`. */
async function repairText({ text }: { text: string }): Promise<string | null> {
  const json = extractFirstJsonObject(text);
  return json === null ? null : JSON.stringify(json);
}

// ---------------------------------------------------------------------------
// Ejecución
// ---------------------------------------------------------------------------

function messagesFor(turn: BenchTurn): LlmMessage[] {
  return buildTurnMessages({
    locale: 'es',
    level: 'B1',
    kind: turn.kind,
    topic: turn.topic,
    roleplay:
      turn.kind === 'roleplay'
        ? { role: 'the other person in the scene', situation: turn.topic }
        : undefined,
    news: turn.kind === 'news' ? { title: turn.topic, summary: turn.topic } : undefined,
    history: turn.history,
    userMessage: turn.userMessage,
  });
}

async function runTurn(
  provider: (modelId: string) => LanguageModel,
  model: string,
  turn: BenchTurn,
): Promise<TurnOutcome> {
  const defaults = PURPOSE_DEFAULTS.turn;
  const messages = messagesFor(turn);
  const promptTokensEstimated = estimateTokens(messages);
  const reasoningEffort = reasoningEffortFor(model);
  const started = Date.now();
  const signal = AbortSignal.timeout(defaults.timeoutMs);

  try {
    const result = await generateObject({
      model: provider(model),
      schema: TurnOutput,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      // Los prompts abren con un mensaje `system`; el SDK 7 lo rechaza sin esto.
      allowSystemInMessages: true,
      temperature: defaults.temperature,
      maxOutputTokens: defaults.maxTokens,
      abortSignal: signal,
      maxRetries: 0,
      repairText,
      providerOptions: reasoningEffort === undefined ? undefined : { '9router': { reasoningEffort } },
    });

    const [first, second] = turn.planted;
    const a = detects(first, result.object.corrections);
    const b = detects(second, result.object.corrections);

    return {
      validJson: true,
      latencyMs: Date.now() - started,
      detectedAtLeastOne: a || b,
      detectedBoth: a && b,
      status: 'ok',
      promptTokensEstimated,
      promptTokensReported: result.usage.inputTokens ?? null,
    };
  } catch (error) {
    return {
      validJson: false,
      latencyMs: Date.now() - started,
      detectedAtLeastOne: false,
      detectedBoth: false,
      status: mapError(error, signal.aborted),
      promptTokensEstimated,
      promptTokensReported: null,
    };
  }
}

/** Ejecuta `tasks` con un tope de concurrencia, conservando el orden de salida. */
async function mapLimit<TIn, TOut>(
  items: readonly TIn[],
  limit: number,
  worker: (item: TIn, index: number) => Promise<TOut>,
): Promise<TOut[]> {
  const results: TOut[] = Array.from({ length: items.length });
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index] as TIn, index);
    }
  });
  await Promise.all(runners);
  return results;
}

async function benchModel(
  provider: (modelId: string) => LanguageModel,
  model: string,
  turns: readonly BenchTurn[],
  options: CliOptions,
): Promise<ModelReport> {
  const queue: BenchTurn[] = [];
  for (let repeat = 0; repeat < options.repeats; repeat++) queue.push(...turns);

  const outcomes = await mapLimit(queue, options.concurrency, (turn) => runTurn(provider, model, turn));

  const valid = outcomes.filter((o) => o.validJson);
  const latencies = valid.map((o) => o.latencyMs);
  const statuses: Record<string, number> = {};
  for (const outcome of outcomes) {
    statuses[outcome.status] = (statuses[outcome.status] ?? 0) + 1;
  }

  const validJsonRate = outcomes.length === 0 ? 0 : valid.length / outcomes.length;
  const p90 = percentile(latencies, 90);

  return {
    model,
    turns: outcomes.length,
    validJsonRate,
    p50: percentile(latencies, 50),
    p90,
    detectionRate:
      valid.length === 0 ? 0 : valid.filter((o) => o.detectedAtLeastOne).length / valid.length,
    bothRate: valid.length === 0 ? 0 : valid.filter((o) => o.detectedBoth).length / valid.length,
    statuses,
    avgPromptTokensEstimated: average(outcomes.map((o) => o.promptTokensEstimated)) ?? 0,
    avgPromptTokensReported: average(
      valid.flatMap((o) => (o.promptTokensReported === null ? [] : [o.promptTokensReported])),
    ),
    passes: validJsonRate >= MIN_VALID_JSON_RATE && p90 < MAX_P90_MS && valid.length > 0,
  };
}

// ---------------------------------------------------------------------------
// Informe
// ---------------------------------------------------------------------------

function pct(value: number): string {
  return `${(value * 100).toFixed(0)} %`;
}

function renderMetricsTable(reports: readonly ModelReport[]): void {
  console.table(
    reports.map((r) => ({
      modelo: r.model,
      llamadas: r.turns,
      'json válido': pct(r.validJsonRate),
      'p50 ms': r.p50,
      'p90 ms': r.p90,
      'detecta ≥1': pct(r.detectionRate),
      'detecta 2': pct(r.bothRate),
      entra: r.passes ? 'sí' : 'no',
    })),
  );
}

function renderPromptTokensTable(reports: readonly ModelReport[]): void {
  console.table(
    reports.map((r) => ({
      modelo: r.model,
      'prompt_tokens router': r.avgPromptTokensReported ?? 'n/d',
      'prompt_tokens estimado': r.avgPromptTokensEstimated,
      diferencia:
        r.avgPromptTokensReported === null
          ? 'n/d'
          : r.avgPromptTokensReported - r.avgPromptTokensEstimated,
    })),
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const turns = loadTurns(options.turnsPath);

  console.log(`Turnos sintéticos: ${turns.length} · repeticiones: ${options.repeats}`);
  console.log(`Modelos a probar (9router): ${options.models.join(', ')}`);

  if (options.dryRun) {
    console.log('\n--dry-run: no se llama a 9router. Prompts por turno:');
    for (const turn of turns) {
      console.log(`\n  ${turn.id} [${turn.kind}] ${turn.planted.map((p) => p.category).join(' + ')}`);
      for (const message of messagesFor(turn)) {
        console.log(`    [${message.role}] ${message.content}`);
      }
    }
    return;
  }

  const url = process.env.NINEROUTER_URL?.trim();
  const apiKey = process.env.NINEROUTER_API_KEY?.trim();
  if (!url || !apiKey) {
    throw new Error('Faltan NINEROUTER_URL y/o NINEROUTER_API_KEY en el entorno.');
  }
  const provider = createNineRouterProvider({ NINEROUTER_URL: url, NINEROUTER_API_KEY: apiKey });

  const reports: ModelReport[] = [];
  for (const model of options.models) {
    process.stdout.write(`\n▶ 9router/${model} `);
    const report = await benchModel(provider, model, turns, options);
    reports.push(report);
    console.log(
      `→ JSON ${pct(report.validJsonRate)} · p50 ${report.p50} ms · p90 ${report.p90} ms · detecta ${pct(
        report.detectionRate,
      )} · ${report.passes ? 'ENTRA' : 'fuera'}`,
    );
  }

  console.log('\nResultado:');
  renderMetricsTable(reports);
  console.log(
    `\nprompt_tokens: router vs. estimado (vigila el system prompt oculto que inyecta 9router):`,
  );
  renderPromptTokensTable(reports);

  if (reports.some((r) => !r.passes)) {
    console.error(
      `\nFalla: algún modelo quedó por debajo de JSON válido ≥ ${MIN_VALID_JSON_RATE * 100} % o p90 < ${
        MAX_P90_MS / 1000
      } s.`,
    );
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  // El mensaje nunca lleva claves: aquí solo hay config y errores del SDK.
  console.error(`\nbench-models falló: ${(error as Error).message}`);
  process.exitCode = 1;
});
