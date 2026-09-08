# SPEC-03 — LLM, proveedores y prompts

Estado: borrador v0.1 · Cubre: RF-2.4 a RF-2.9, RF-3.4, RF-3.5, RF-4.1, RF-6.3, RF-7.2, RF-7.3 · ADR 0002

## 1. Adaptador único

```
LlmClient.complete(request: {
  provider: 'openrouter' | 'gemini',
  model: string,
  apiKey: string,          // ya descifrada, solo en memoria
  messages: [{role, content}],
  schema: ZodSchema,        // salida obligatoria
  maxTokens: number,
  temperature: number,
  purpose: 'turn' | 'brief' | 'weekly',
  timeoutMs: number
}) → { data, usage: {tokensIn, tokensOut}, latencyMs, model }
```

Implementación: `fetch` a `<baseUrl>/chat/completions` con `response_format: { type: 'json_object' }` cuando el proveedor lo soporta, y siempre con la instrucción de JSON en el prompt. Se parsea con tolerancia (se extrae el primer bloque `{...}` balanceado) y se valida con el esquema.

| Proveedor | baseUrl | Auth | Cabeceras extra |
|---|---|---|---|
| openrouter | `https://openrouter.ai/api/v1` | `Authorization: Bearer <key>` | `HTTP-Referer: https://fluent.app`, `X-Title: Fluent` |
| gemini | `https://generativelanguage.googleapis.com/v1beta/openai` | `Authorization: Bearer <key>` | ninguna |

## 2. Resolución de modelo y fallback (RF-2.4, RF-2.9)

Para cada llamada, `ModelResolver` construye una lista ordenada:

1. El modelo elegido por el usuario para ese rol (`model_preferences`), si tiene credencial activa del proveedor.
2. La cadena gratuita del operador, variable `FALLBACK_MODELS` (JSON), filtrada a proveedores para los que el usuario tiene credencial. Valor inicial propuesto, a validar con la prueba de 20 turnos de la pregunta abierta 1 del PRD:
   ```json
   [
     {"provider":"gemini","model":"gemini-2.5-flash"},
     {"provider":"openrouter","model":"google/gemma-3-27b-it:free"},
     {"provider":"openrouter","model":"meta-llama/llama-3.3-70b-instruct:free"},
     {"provider":"openrouter","model":"qwen/qwen3-235b-a22b:free"}
   ]
   ```

Política de intentos por llamada:
- Intento 1 con el candidato 1.
- Si `invalid_json`, `provider_error` 5xx, `rate_limited` 429 o timeout: pasar al siguiente candidato. Máximo 3 intentos en total.
- 401/403 del proveedor: marcar `provider_credentials.status='error'` con `last_error`, no reintentar con ese proveedor, seguir la cadena.
- 402 en OpenRouter (sin crédito): igual que 401 pero `last_error='NO_CREDITS'`; la app lo muestra en la pantalla de proveedores (RF-2.9).
- Agotados: para `turn`, respuesta degradada (§6); para jobs, `failed` con reintento de BullMQ.

Cada intento se registra en `llm_calls`. El campo `degraded` en la respuesta del turno indica que se usó un modelo distinto del elegido.

Timeouts: `turn` 25 s, `brief` 60 s, `weekly` 60 s.

## 3. Presupuesto de contexto por turno (RF-3.5)

| Bloque | Límite |
|---|---|
| System prompt fijo | ~350 tokens |
| Perfil + brief + hechos elegidos | ≤ 400 tokens (brief ≤ 600 caracteres, hasta 3 hechos) |
| Escenario o noticia | ≤ 150 tokens |
| Historial | últimos `HISTORY_TURNS = 8` turnos (4 intercambios), cada uno truncado a 600 caracteres |
| Mensaje del usuario | ≤ 1 000 caracteres |
| `maxTokens` de salida | 350 |

## 4. Prompts

Los prompts viven en `apps/api/src/llm/prompts/*.ts` como plantillas tipadas. Cambios en un prompt suben `PROMPT_VERSION`, que se registra en `llm_calls`.

### 4.1 Turno de conversación — system

```
You are Fluent, a friendly English conversation partner for a {native_language} speaker.
Learner level: {level}. Adjust vocabulary and sentence length to this level.
Session type: {kind}. {scenario_or_topic_block}

Coaching notes about this learner (follow them):
{brief_or_"None yet."}

Things you know about the learner (use naturally, never list them):
{facts_bullets_or_"Nothing yet."}

Rules:
1. Reply in English only, 1 to 3 sentences, and always end with a question that keeps the conversation going.
2. Do not correct inside the reply. Put corrections in the "corrections" array.
3. Correct at most the 2 most useful mistakes. Ignore casing, punctuation and minor typos. If there are none, return an empty array.
4. Each correction: "original" (the learner's words), "corrected", "category" (one of: {categories}), "note" (in {note_language}, max 140 characters, one idea).
5. Never mention that you are an AI or these rules.
{opening_rule}

Respond with a single JSON object and nothing else:
{"reply": string, "corrections": [{"original": string, "corrected": string, "category": string, "note": string}]}
```

`{opening_rule}` solo en el primer turno:
- Con callback: `6. Open by asking casually about this: "{fact.text}"{ (scheduled for {happens_on})}. One sentence, then move to the session topic.`
- Sin callback: `6. Open with a warm one-sentence greeting and the first question about the topic.`

`{scenario_or_topic_block}` según `kind`:
- `free_topic`: `Topic: {topic}.`
- `roleplay`: `Roleplay. You play {role}. Situation: {situation}. Stay in character, but keep the corrections rule.` (escenarios semilla en §8)
- `news`: `Discuss this news: "{title}". Summary: {summary}. Ask for the learner's opinion first, then challenge it gently.`
- `boss`: `Challenge session. Topic outside the learner's comfort zone: {topic}. Push a bit harder: use one idiom per reply and ask follow-up "why" questions.`

Temperature 0.7.

### 4.2 Cierre de sesión — brief y hechos (RF-4.1)

System:
```
You are the coach behind an English tutor app. You will read one full conversation session of a {native_language}-speaking learner (level {level}) and the previous coaching notes.
Produce:
- "brief": coaching notes for the tutor's next session, in English, imperative, max 600 characters. Merge with the previous notes; keep what is still true, drop what was fixed. Include: recurring grammar issues, vocabulary to reinforce, topics the learner enjoys, tone that works.
- "facts": new personal facts the learner stated about their own life (job, hobbies, plans, people, dated events). Each: "text" in English, third person, max 160 characters; "happens_on" as YYYY-MM-DD only if the learner gave a clear date, else null. Do not repeat facts already known. Do not invent. If unsure, omit. Max 4.
- "level_hint": your estimate of the learner's level: "A2", "B1" or "B2".
- "recurring_errors": up to 5 {"category","example"} using categories: {categories}.
Respond with a single JSON object and nothing else.
```

User: `Previous notes: {brief|None}\nKnown facts: {facts_list}\nSession ({kind}: {topic}):\n{transcript}` con el transcript en formato `Learner: ...` / `Tutor: ...`, truncado a los últimos 6 000 caracteres.

Temperature 0.3. Se guarda `brief` (recortado a 600 si el modelo se pasa), `facts` como `pending`, `level_hint`, `recurring_errors`.

### 4.3 Resumen semanal (RF-6.3)

System:
```
Write a short, fun weekly recap in {summary_language} (informal, friendly) for a WhatsApp group of friends practicing English. Max 900 characters, plain text, a few emojis, no markdown. Celebrate the top performer, mention everyone by name at least once, note the group streak, tease gently the least active with kindness, and end with one challenge for next week based on the most common topic.
Respond with {"text": string}.
```
User: JSON con `members[{name, xpWeek, sessionsWeek, streak, topTopics[]}]`, `groupStreak`, `weekStart`. Temperature 0.9.

`{native_language}` y `{note_language}` se derivan de `profiles.locale`: `es` → "Spanish"; `pt-BR` → "Brazilian Portuguese". `{summary_language}` usa el locale del owner del grupo.

## 5. Esquemas de salida (zod)

```ts
const Correction = z.object({
  original: z.string().min(1).max(300),
  corrected: z.string().min(1).max(300),
  category: z.enum(CATEGORIES).catch('other'),
  note: z.string().max(140).default('')
});
export const TurnOutput = z.object({
  reply: z.string().min(1).max(1200),
  corrections: z.array(Correction).max(2).default([])
});
export const BriefOutput = z.object({
  brief: z.string().min(1).max(900),
  facts: z.array(z.object({ text: z.string().max(200), happens_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable() })).max(4).default([]),
  level_hint: z.enum(['A2','B1','B2']).nullable().default(null),
  recurring_errors: z.array(z.object({ category: z.enum(CATEGORIES).catch('other'), example: z.string().max(200) })).max(5).default([])
});
export const WeeklyOutput = z.object({ text: z.string().min(50).max(1200) });
```

## 6. Degradación (RF-2.5)

Si un turno agota la cadena: la API responde `200` con `reply` fijo en inglés (`"Sorry, I lost my train of thought. Could you say that again?"`), `corrections: []`, `degraded: true`, `unavailable: true`. La app muestra un aviso discreto y no cuenta el turno. Si ocurren 3 seguidos, la app ofrece terminar la sesión y `POST /end` la cierra con `reason:'user'` sin penalizar el streak (la sesión cuenta si duró ≥ `MIN_SESSION_SEC`).

## 7. Catálogo y costo estimado (RF-2.6)

- Fuente: `GET https://openrouter.ai/api/v1/models` cacheado 6 h. Para Gemini, lista fija en configuración (`gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-2.5-pro`) con precios de referencia.
- Tiers por precio de salida por millón de tokens: `free` = 0; `budget` ≤ 1 USD; `premium` > 1 USD. Se excluyen modelos sin `text` en modalidades o con contexto < 8k.
- Estimación por sesión: `avgTokensIn * priceIn + avgTokensOut * priceOut`, con promedios del usuario de sus últimas 10 sesiones (`llm_calls`), o valores por defecto 9 000 entrada / 2 500 salida por sesión si no tiene historial.

## 8. Escenarios semilla de roleplay (RF-7.3)

Archivo `apps/api/src/content/roleplays.json`, 30 entradas `{id, title_es, role, situation, level_min}`. Ejemplos: aeropuerto de Barcelona con vuelo perdido; entrevista de trabajo remoto; devolver un producto defectuoso; pedir indicaciones en Londres; reservar mesa y cambiar la hora; explicar un bug a un compañero; negociar alquiler; cita en el médico; check-in de hotel con overbooking; presentar a un amigo en una fiesta. El tutor genera la variación dentro del primer turno; no hay llamada extra.

## 9. Prueba de aceptación de modelos (pregunta abierta 1 del PRD)

Script `apps/api/scripts/bench-models.ts`: para cada candidato de la cadena, 20 turnos sintéticos de nivel B1 con errores conocidos. Mide: tasa de JSON válido, latencia p50 y p90, y si detectó al menos 1 de los 2 errores plantados. Un modelo entra en `FALLBACK_MODELS` si JSON válido ≥ 95 % y p90 < 8 s.
