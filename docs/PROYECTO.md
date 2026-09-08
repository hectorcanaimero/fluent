# App de Inglés Conversacional con IA — Brief del Proyecto

## El pitch

Una app de práctica de inglés conversacional, con IA, para vos y tu grupo de amigos.
Sesiones cortas (10 min, 2 veces al día), por voz, sobre tópicos que elegís o noticias
de tu interés. El tutor no es genérico: recuerda quién sos, en qué fallás seguido,
y ajusta la conversación sesión a sesión. Gamificado, con un componente social fuerte
entre el grupo — no es "vos contra la app", es "vos y tus amigos practicando juntos".

Doble propósito: practicar inglés en serio, y que el desarrollo del proyecto en sí
sea un ejercicio de arquitectura de software que valga la pena estudiar.

---

## Alcance v1: proyecto personal, no producto

- Para vos y un grupo cerrado de amigos (5-10 personas), no para el público.
- Sin monetización, sin tier premium, sin Stripe. Se agrega después si algún día
  tiene sentido.
- Prioridad #1 de diseño: **gastar lo mínimo posible en LLM.** Todo lo demás se
  decide en función de esto.

---

## Stack técnico

```
Flutter (app móvil, Android/iOS)
        │
        ▼
NestJS (servicio propio, corre en tu Hetzner vía Coolify)
   ├─ Proxy hacia OpenRouter (BYOK del usuario vía OAuth PKCE)
   ├─ Lógica de negocio: XP, streaks, perfiles, "coaching brief"
   └─ BullMQ + Redis: jobs en background (noticias, briefs post-sesión, recordatorios)
        │
        ▼
InsForge (self-hosted, Docker) → Auth + Postgres + Storage
```

**Por qué así:**
- **Flutter** — un codebase, buen manejo nativo de audio/voz (STT/TTS), no WebView.
- **InsForge** — reemplaza Supabase/Firebase/etc. para lo que hace bien: auth,
  Postgres, storage. Open source (Apache-2.0), 12.7k stars, self-hosted vía
  Docker Compose — no depende de un proveedor cerrado.
- **NestJS separado** (no edge functions) — porque BullMQ necesita un worker
  persistente, y el streaming de la conversación necesita estado de sesión.
  Esto es lo que ya usás en tus otros proyectos, así que no es una pieza nueva
  que mantener, es una que ya sabés operar.
- **LLM: 100% BYOK vía OpenRouter en v1.** Cada amigo conecta su propia cuenta
  gratuita (flujo PKCE ya validado en el POC). Costo marginal para vos: $0.

---

## Cómo se controla el costo de LLM (el principio rector)

- Un único prompt por turno de conversación: el modelo responde y corrige en la
  misma llamada (JSON: `{reply, corrections[]}`). Nunca dos llamadas separadas
  para lo mismo.
- Nada de RAG / embeddings / pgvector. El "conocimiento" de cada usuario es chico
  y estructurado — entra entero en el contexto sin necesidad de buscarlo.
- Una sola llamada extra por sesión (no por turno) para generar el "coaching brief"
  post-sesión — y esa corre async en background vía BullMQ, no bloquea al usuario.
- Modelos gratis de OpenRouter por default. Si en el futuro hay tier pago, ahí se
  habilita otra cosa — no ahora.

---

## Lo que le da "engagement diario" (el corazón del diseño)

### Memoria y callback — la idea que más entusiasmo generó
El tutor extrae hechos puntuales de cada conversación (trabajo, hobbies, eventos
con fecha) y los usa para abrir la siguiente sesión con naturalidad:
*"¿cómo te fue en la entrevista del viernes?"* Esto es extracción + inyección en
prompt, no fine-tuning ni RAG — barato y con altísimo impacto percibido.

Reglas para que funcione bien:
- Que no aparezca en TODAS las aperturas — si es predecible, se siente vigilancia
  en vez de magia.
- Pantalla de "esto es lo que recuerdo de vos", editable — soluciona privacidad
  entre amigos y corrige alucinaciones del modelo (los modelos gratis chicos
  pueden inventar datos).

### Coaching brief generativo
Después de cada sesión, una llamada async sintetiza patrones ("evita el present
perfect", "le interesa fútbol y tech") y ese texto se inyecta en el próximo prompt.
El tutor cambia de comportamiento sesión a sesión sin entrenar nada.

### Social — el ángulo que diferencia esto de un Duolingo cualquiera
- Streak grupal / leaderboard semanal entre amigos.
- Resumen semanal generado en texto (no solo stats) pensado para tirarlo al grupo
  de WhatsApp — motivador y compartible.
- Desafíos cruzados: "tu amigo practicó sobre X esta semana, ¿te animás al mismo
  tema?"
- "Boss battles" ocasionales: cada N sesiones, un tema fuera de tu zona de confort.

### Variedad sin costo extra
- Roleplays generados sobre la marcha en vez de temas fijos ("estás en el
  aeropuerto de Barcelona, perdiste el vuelo") — mismo tópico, infinita variación,
  una sola llamada.
- Noticias como generador de preguntas de opinión ajustadas al nivel, cacheadas
  una vez al día vía RSS (no NewsAPI, su free tier es muy limitado).

---

## Lo que se deja para después (v2+, no ahora)

- Tier premium con LLMs pagos + Stripe.
- Fine-tuning o cualquier variante de "entrenar" el modelo — nunca tuvo sentido
  para este tamaño de proyecto, descartado del todo.
- RAG/pgvector — solo si algún día hay cientos de horas de conversación por
  usuario y hace falta memoria semántica de largo plazo. Lejos.
- Personalidad elegible del tutor (varios "personajes").
- Multi-agente (conversador + evaluador separados) — interesante para estudiar
  orquestación, pero no bloquea el MVP.
- Push notifications con Firebase — arrancar sin esto, un aviso en el chat de
  amigos alcanza al principio.
- Dificultad adaptativa automática más allá del coaching brief básico.

---

## Riesgos técnicos a tener en el radar

- **Compute de InsForge está en private preview** — si algún día se quiere mover
  lógica pesada ahí, confirmar disponibilidad antes de planificar sobre eso.
  Por ahora no lo necesitamos (NestJS cubre esa parte).
- **Modelos gratis alucinando en la extracción de hechos** — es el riesgo real
  de la feature de memoria, más que cualquier tema de privacidad.
- **Calidad de modelos gratis en general** — vale la pena tener un modelo de
  fallback si el principal de OpenRouter está caído o degradado.

---

## El doble propósito de estudio

- **Idioma**: para vos y tus amigos, uso real medible (streaks, errores que bajan).
- **Arquitectura**: el patrón BaaS (InsForge) + servicio de dominio (NestJS) +
  jobs async (BullMQ) es un patrón real de producción, vale la pena documentarlo
  a medida que se construye — no es una limitación, es la parte que más se
  puede aprovechar para estudiar.
