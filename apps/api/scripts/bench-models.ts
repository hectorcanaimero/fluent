/**
 * Banco de pruebas de modelos (SPEC-03 §9, pregunta abierta 1 del PRD).
 *
 * Para cada modelo candidato lanza los 20 turnos sintéticos de nivel B1 de
 * `fixtures/bench/turns.json` (cada uno con dos errores plantados y su categoría) y
 * mide:
 *   - tasa de JSON válido (respuesta que pasa el esquema `TurnOutput`),
 *   - latencia p50 y p90,
 *   - si detectó al menos 1 de los 2 errores plantados.
 *
 * Criterio de SPEC-03 §9: un modelo entra en `FALLBACK_MODELS` si su tasa de JSON
 * válido es ≥ 95 % y su p90 < 8 s.
 *
 * Este script NO se ejecuta en CI ni en los tests: lo corre el operador con SUS
 * claves y pega la tabla resultante en la spec.
 *
 *   cd apps/api
 *   export OPENROUTER_API_KEY=...      # opcional, para los modelos de OpenRouter
 *   export GEMINI_API_KEY=...          # opcional, para los modelos de Gemini
 *   pnpm bench:models
 *   pnpm bench:models -- --models "openrouter:google/gemma-3-27b-it:free,gemini:gemini-2.5-flash"
 *   pnpm bench:models -- --repeats 2 --concurrency 2 --dry-run
 *
 * Las claves se leen solo de variables de entorno y nunca se imprimen ni se escriben
 * en el informe.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_FALLBACK_MODELS,
  PURPOSE_DEFAULTS,
  parseFallbackModels,
  type FallbackModel,
  type Provider,
  type SessionKind,
} from '../src/llm/config.js';
import { LlmCallError, LlmClient, type LlmCallStatus } from '../src/llm/llm.client.js';
import { PROMPT_VERSION, buildTurnMessages } from '../src/llm/prompts/index.js';
import { CATEGORIES, TurnOutput, type Category } from '../src/llm/schemas.js';

/** SPEC-03 §9. */
const MIN_VALID_JSON_RATE = 0.95;
const MAX_P90_MS = 8000;

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
  readonly turnId: string;
  readonly validJson: boolean;
  readonly latencyMs: number;
  readonly detectedAtLeastOne: boolean;
  readonly detectedBoth: boolean;
  readonly status: LlmCallStatus;
}

interface ModelReport {
  readonly provider: Provider;
  readonly model: string;
  readonly turns: number;
  readonly validJsonRate: number;
  readonly p50: number;
  readonly p90: number;
  readonly detectionRate: number;
  readonly bothRate: number;
  readonly statuses: Record<string, number>;
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
function detects(
  planted: PlantedError,
  corrections: TurnOutput['corrections'],
): boolean {
  const trigger = normalize(planted.trigger);
  return corrections.some((correction) => {
    if (correction.category === planted.category) return true;
    const original = normalize(correction.original);
    return original.includes(trigger) || trigger.includes(original);
  });
}

interface CliOptions {
  readonly models: readonly FallbackModel[];
  readonly repeats: number;
  readonly concurrency: number;
  readonly dryRun: boolean;
  readonly outDir: string | null;
  readonly turnsPath: string;
}

function parseModelsArg(raw: string): FallbackModel[] {
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const separator = entry.indexOf(':');
      const provider = entry.slice(0, separator);
      const model = entry.slice(separator + 1);
      if (provider !== 'openrouter' && provider !== 'gemini') {
        throw new Error(`Proveedor desconocido en --models: "${provider}"`);
      }
      if (model.length === 0) {
        throw new Error(`Falta el modelo en --models: "${entry}"`);
      }
      return { provider, model };
    });
}

function parseArgs(argv: readonly string[]): CliOptions {
  const get = (name: string): string | undefined => {
    const index = argv.indexOf(`--${name}`);
    return index === -1 ? undefined : argv[index + 1];
  };

  const modelsArg = get('models');
  const fromEnv = process.env.FALLBACK_MODELS;
  const models = modelsArg
    ? parseModelsArg(modelsArg)
    : fromEnv
      ? parseFallbackModels(fromEnv)
      : DEFAULT_FALLBACK_MODELS;

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
    outDir: get('out-dir') ?? null,
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

/** Claves del operador. Nunca se imprimen. */
function readApiKeys(): Partial<Record<Provider, string>> {
  const keys: Partial<Record<Provider, string>> = {};
  const openrouter = process.env.OPENROUTER_API_KEY?.trim();
  const gemini = process.env.GEMINI_API_KEY?.trim();
  if (openrouter) keys.openrouter = openrouter;
  if (gemini) keys.gemini = gemini;
  return keys;
}

// ---------------------------------------------------------------------------
// Ejecución
// ---------------------------------------------------------------------------

function messagesFor(turn: BenchTurn) {
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
  client: LlmClient,
  candidate: FallbackModel,
  apiKey: string,
  turn: BenchTurn,
): Promise<TurnOutcome> {
  const defaults = PURPOSE_DEFAULTS.turn;
  try {
    const result = await client.complete({
      provider: candidate.provider,
      model: candidate.model,
      apiKey,
      messages: messagesFor(turn),
      schema: TurnOutput,
      maxTokens: defaults.maxTokens,
      temperature: defaults.temperature,
      purpose: 'turn',
      timeoutMs: defaults.timeoutMs,
    });

    const [first, second] = turn.planted;
    const a = detects(first, result.data.corrections);
    const b = detects(second, result.data.corrections);

    return {
      turnId: turn.id,
      validJson: true,
      latencyMs: result.latencyMs,
      detectedAtLeastOne: a || b,
      detectedBoth: a && b,
      status: 'ok',
    };
  } catch (error) {
    const status = error instanceof LlmCallError ? error.status : 'provider_error';
    const latencyMs = error instanceof LlmCallError ? error.latencyMs : 0;
    return {
      turnId: turn.id,
      validJson: false,
      latencyMs,
      detectedAtLeastOne: false,
      detectedBoth: false,
      status,
    };
  }
}

/** Ejecuta `tasks` con un tope de concurrencia, conservando el orden de salida. */
async function mapLimit<TIn, TOut>(
  items: readonly TIn[],
  limit: number,
  worker: (item: TIn, index: number) => Promise<TOut>,
): Promise<TOut[]> {
  const results = new Array<TOut>(items.length);
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
  client: LlmClient,
  candidate: FallbackModel,
  apiKey: string,
  turns: readonly BenchTurn[],
  options: CliOptions,
): Promise<ModelReport> {
  const queue: BenchTurn[] = [];
  for (let repeat = 0; repeat < options.repeats; repeat++) queue.push(...turns);

  const outcomes = await mapLimit(queue, options.concurrency, (turn) =>
    runTurn(client, candidate, apiKey, turn),
  );

  const valid = outcomes.filter((o) => o.validJson);
  const latencies = valid.map((o) => o.latencyMs);
  const statuses: Record<string, number> = {};
  for (const outcome of outcomes) {
    statuses[outcome.status] = (statuses[outcome.status] ?? 0) + 1;
  }

  const validJsonRate = outcomes.length === 0 ? 0 : valid.length / outcomes.length;
  const p90 = percentile(latencies, 90);

  return {
    provider: candidate.provider,
    model: candidate.model,
    turns: outcomes.length,
    validJsonRate,
    p50: percentile(latencies, 50),
    p90,
    detectionRate:
      valid.length === 0 ? 0 : valid.filter((o) => o.detectedAtLeastOne).length / valid.length,
    bothRate: valid.length === 0 ? 0 : valid.filter((o) => o.detectedBoth).length / valid.length,
    statuses,
    passes: validJsonRate >= MIN_VALID_JSON_RATE && p90 < MAX_P90_MS && valid.length > 0,
  };
}

// ---------------------------------------------------------------------------
// Informe
// ---------------------------------------------------------------------------

function pct(value: number): string {
  return `${(value * 100).toFixed(0)} %`;
}

function renderReport(
  reports: readonly ModelReport[],
  turnsCount: number,
  options: CliOptions,
  date: string,
): string {
  const rows = reports.map(
    (r) =>
      `| ${r.provider} | \`${r.model}\` | ${r.turns} | ${pct(r.validJsonRate)} | ${r.p50} ms | ${r.p90} ms | ${pct(
        r.detectionRate,
      )} | ${pct(r.bothRate)} | ${r.passes ? 'sí' : 'no'} |`,
  );

  const chain = reports
    .filter((r) => r.passes)
    .map((r) => `    {"provider":"${r.provider}","model":"${r.model}"}`)
    .join(',\n');

  const failures = reports
    .map((r) => {
      const detail = Object.entries(r.statuses)
        .filter(([status]) => status !== 'ok')
        .map(([status, count]) => `${status}: ${count}`)
        .join(', ');
      return detail ? `- \`${r.model}\` (${r.provider}): ${detail}` : null;
    })
    .filter((line): line is string => line !== null);

  return [
    `# Banco de pruebas de modelos — ${date}`,
    '',
    `Resultado de \`apps/api/scripts/bench-models.ts\` (SPEC-03 §9). ${turnsCount} turnos sintéticos`,
    `de nivel B1 por modelo, ${options.repeats} repetición(es), concurrencia ${options.concurrency},`,
    `versión de prompt \`${PROMPT_VERSION}\`.`,
    '',
    `Criterio de admisión en \`FALLBACK_MODELS\`: JSON válido ≥ ${MIN_VALID_JSON_RATE * 100} % y p90 < ${
      MAX_P90_MS / 1000
    } s.`,
    '',
    '| Proveedor | Modelo | Llamadas | JSON válido | p50 | p90 | Detecta ≥1 error | Detecta los 2 | Entra |',
    '|---|---|---|---|---|---|---|---|---|',
    ...rows,
    '',
    '## Fallos por modelo',
    '',
    ...(failures.length > 0 ? failures : ['- Ninguno.']),
    '',
    '## Cadena resultante',
    '',
    'Valor sugerido para la variable de entorno `FALLBACK_MODELS`:',
    '',
    '```json',
    '[',
    chain,
    ']',
    '```',
    '',
    '> Pega esta tabla en `docs/specs/SPEC-03-llm-y-prompts.md` §2 y cierra la pregunta abierta 1 del PRD.',
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const turns = loadTurns(options.turnsPath);
  const keys = readApiKeys();

  const runnable = options.models.filter((candidate) => keys[candidate.provider] !== undefined);
  const skipped = options.models.filter((candidate) => keys[candidate.provider] === undefined);

  console.log(`Turnos sintéticos: ${turns.length} · repeticiones: ${options.repeats}`);
  console.log(`Modelos a probar: ${runnable.length} de ${options.models.length}`);
  for (const candidate of skipped) {
    console.log(
      `  omitido ${candidate.provider}/${candidate.model}: falta ${
        candidate.provider === 'openrouter' ? 'OPENROUTER_API_KEY' : 'GEMINI_API_KEY'
      }`,
    );
  }

  if (options.dryRun) {
    console.log('\n--dry-run: no se llama a ningún proveedor. Turnos cargados y validados.');
    for (const turn of turns) {
      console.log(`  ${turn.id} [${turn.kind}] ${turn.planted.map((p) => p.category).join(' + ')}`);
    }
    return;
  }

  if (runnable.length === 0) {
    throw new Error(
      'No hay ninguna clave de proveedor en el entorno. Exporta OPENROUTER_API_KEY o GEMINI_API_KEY.',
    );
  }

  const client = new LlmClient();
  const reports: ModelReport[] = [];

  for (const candidate of runnable) {
    process.stdout.write(`\n▶ ${candidate.provider}/${candidate.model} `);
    const report = await benchModel(
      client,
      candidate,
      keys[candidate.provider] as string,
      turns,
      options,
    );
    reports.push(report);
    console.log(
      `→ JSON ${pct(report.validJsonRate)} · p50 ${report.p50} ms · p90 ${report.p90} ms · detecta ${pct(
        report.detectionRate,
      )} · ${report.passes ? 'ENTRA' : 'fuera'}`,
    );
  }

  const date = new Date().toISOString().slice(0, 10);
  const spec = findUp(HERE, 'docs/specs/SPEC-03-llm-y-prompts.md');
  const specsDir = options.outDir ?? (spec !== null ? dirname(spec) : process.cwd());
  if (!existsSync(specsDir)) mkdirSync(specsDir, { recursive: true });

  const outPath = join(specsDir, `bench-${date}.md`);
  writeFileSync(outPath, renderReport(reports, turns.length, options, date), 'utf-8');
  console.log(`\nInforme escrito en ${outPath}`);
}

main().catch((error: unknown) => {
  // El mensaje nunca lleva claves: LlmCallError las redacta y aquí solo hay config.
  console.error(`\nbench-models falló: ${(error as Error).message}`);
  process.exitCode = 1;
});
