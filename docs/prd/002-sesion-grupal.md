---
type: prd
project_id: fluent
version: 0.1
status: accepted
generated_by: orch-prd
generated_at: 2026-10-06
title: Sesión grupal con el tutor IA
---

# Sesión grupal con el tutor IA

## Problema

Hoy cada miembro practica solo con el tutor. Lo social de Fluent (leaderboard,
resumen semanal, desafíos cruzados) es indirecto: el grupo compite, pero nunca
conversa en inglés entre sí. Justamente lo que más cuesta a un A2–B2 es seguir
una conversación con varias personas, interrumpir, responder a alguien que no es
el tutor. Eso no se entrena en sesiones 1 a 1.

Mientras tanto el grupo ya habla, pero en WhatsApp y en español. La práctica en
grupo, si pasa, pasa fuera de la app, sin corrección y sin contar para el
progreso.

## Usuarios

- **Miembro del grupo** — quiere practicar inglés con sus amigos, con alguien que
  modere y corrija, sin pasar vergüenza en público por cada error.
- **Iniciador** — cualquier miembro que abre una sesión grupal y convoca al resto.
- **Operador** — necesita que el costo LLM de una sesión con varias personas siga
  siendo predecible y que no rompa el presupuesto por usuario.

## Goals

- G1 — Al menos una sesión grupal por semana con 3 o más participantes en el
  grupo durante el primer mes tras el lanzamiento.
- G2 — Cada participante envía al menos 5 mensajes por sesión grupal (mediana).
- G3 — El costo LLM de una sesión grupal no supera el de las sesiones
  individuales equivalentes de sus participantes (mismo tope diario de turnos).

## Non-goals

- **Chat libre permanente del grupo** (estilo WhatsApp siempre abierto): la
  sesión tiene inicio y fin; fuera de ella no hay mensajería.
- **Videollamada o audio en vivo**: se habla por mensajes (texto o nota de voz),
  no en una llamada simultánea.
- **Sesiones con personas de otros grupos** o varios grupos por usuario
  (RF-1.4 sigue vigente).
- **Mensajes privados 1 a 1** entre miembros.
- **Moderación de contenido automática**: es un grupo cerrado de amigos.

## Functional requirements

### Ciclo de vida

- **FR-1** — Un miembro inicia una sesión grupal eligiendo tipo (tema libre,
  roleplay, noticia, como en RF-3.7). *Acceptance:* la sesión aparece como
  "en curso" para todos los miembros del grupo con el tema y el iniciador.
- **FR-2** — Al iniciar, los demás miembros reciben una notificación push
  "X abrió una sesión grupal sobre Y". *Acceptance:* con la app cerrada, un
  miembro recibe la notificación en menos de 10 s y al tocarla entra a la sesión.
- **FR-3** — Cualquier miembro del grupo puede unirse o salir de una sesión en
  curso. *Acceptance:* al unirse ve los mensajes anteriores de esa sesión; al
  salir deja de recibir mensajes y push de ella.
- **FR-4** — Solo puede haber una sesión grupal en curso por grupo.
  *Acceptance:* intentar iniciar una segunda muestra la existente y ofrece unirse.
- **FR-5** — La sesión termina cuando el iniciador la cierra, cuando pasan 30
  minutos desde el inicio, o tras 10 minutos sin mensajes. *Acceptance:* en
  cualquiera de los tres casos todos los participantes ven "sesión terminada" y
  ya no pueden enviar mensajes.

### Mensajes

- **FR-6** — Un participante envía mensajes de texto. *Acceptance:* el resto de
  participantes conectados lo ve en menos de 2 s sin refrescar.
- **FR-7** — Un participante envía una nota de voz de hasta 60 s. Se transcribe
  en el dispositivo (como RF-3.1, con revisión antes de enviar) y se publican
  audio y transcripción. *Acceptance:* los demás pueden reproducir el audio y
  leer la transcripción; el tutor responde a la transcripción.
- **FR-8** — Los participantes ausentes reciben push de los mensajes nuevos de
  una sesión en la que están, agrupados (como mucho uno por minuto).
  *Acceptance:* con la app en segundo plano, 5 mensajes en 30 s generan una
  sola notificación.

### Tutor

- **FR-9** — El tutor participa como un miembro más: modera, hace preguntas,
  nombra a quién le toca e incorpora a quien lleva rato sin hablar.
  *Acceptance:* en una sesión de 3 personas, si una no escribió en sus últimos
  4 mensajes del grupo, el tutor la menciona por nombre.
- **FR-10** — El tutor no responde a cada mensaje: responde cuando lo mencionan,
  cuando la conversación se estanca (60 s sin mensajes) o cada N mensajes de
  participantes (N configurable, inicial 3). *Acceptance:* 3 mensajes seguidos
  de participantes producen exactamente una respuesta del tutor.
- **FR-11** — Cada mensaje de un participante recibe correcciones, visibles
  solo para su autor por defecto, con el mismo formato de chip de RF-3.4 y en
  su idioma de interfaz. *Acceptance:* otro participante no ve las
  correcciones de un mensaje ajeno.
- **FR-12** — El autor puede marcar "compartir mis correcciones" para la
  sesión. *Acceptance:* con la opción activa, los demás ven sus chips.
- **FR-13** — El tutor adapta el registro al nivel más bajo de los
  participantes presentes. *Acceptance:* con un A2 en la sesión, las respuestas
  del tutor no usan vocabulario por encima de B1 (verificado en el banco de
  prompts).

### Eventos automáticos

- **FR-14** — La sesión muestra eventos del sistema: alguien se une, alguien
  sale, sesión por terminar (aviso a los 25 min), sesión terminada.
  *Acceptance:* cada uno aparece como línea diferenciada de los mensajes.
- **FR-15** — Al terminar, la sesión muestra un cierre con XP ganado por
  participante y un recap breve del tutor (temas tratados, una frase destacada
  por persona). *Acceptance:* el cierre aparece para todos los participantes y
  queda en el historial.

### Progreso e historial

- **FR-16** — Participar suma XP según mensajes enviados y duración presente,
  y cuenta para el streak individual igual que una sesión 1 a 1 si el
  participante envió al menos 5 mensajes. *Acceptance:* el leaderboard semanal
  refleja el XP de la sesión grupal.
- **FR-17** — Cada participante ve sus sesiones grupales en su historial, con
  los mensajes y sus propias correcciones. *Acceptance:* quien no participó no
  ve la sesión en su historial.
- **FR-18** — Los errores de un participante en sesión grupal alimentan su
  coaching brief y sus errores recurrentes (RF-4.1, RF-4.7). Los hechos
  personales **no** se extraen de sesiones grupales. *Acceptance:* tras una
  sesión grupal, el brief del usuario cambia y no aparecen hechos pendientes
  nuevos.

## Non-functional requirements

- **NFR-1 — Costo.** Cada respuesta del tutor es una sola llamada LLM que
  produce respuesta y correcciones de los mensajes acumulados (principio 1 del
  PRD v1). El recap final es una llamada por sesión. Las llamadas se descuentan
  del tope diario de turnos (RF-2.6) del participante que la disparó.
- **NFR-2 — Modelo.** La sesión grupal usa el combo del iniciador según su plan
  (RF-2.4/2.5).
- **NFR-3 — Privacidad.** Excepción explícita a RF-6.5: los mensajes de una
  sesión grupal son visibles para los miembros del grupo que participaron.
  Correcciones privadas por defecto (FR-11). Hechos personales y brief nunca se
  exponen ni se inyectan en el prompt grupal.
- **NFR-4 — Latencia.** Mensaje de participante visible para los demás en
  < 2 s (p90). Primer token del tutor < 3 s en el 90 % de sus respuestas.
- **NFR-5 — Almacenamiento.** Las notas de voz se conservan 30 días y luego se
  borran; la transcripción queda.
- **NFR-6 — Seguridad.** Solo miembros del grupo pueden leer o escribir en sus
  sesiones; el aislamiento se verifica con tests de acceso.
- **NFR-7 — Restricción de stack.** Backend existente (NestJS + InsForge +
  BullMQ), push existente, STT/TTS nativos.

## Assumptions

- La sesión es **en vivo pero tolerante**: no exige que todos estén a la vez;
  se puede entrar tarde dentro de la ventana de 30 min (FR-3, FR-5).
- 30 min de duración máxima y 10 de inactividad son valores iniciales
  configurables.
- El tutor no responde a cada mensaje (FR-10) para contener el costo y no
  acaparar la conversación.
- Las notas de voz son la única excepción al principio "voz en el dispositivo":
  el audio se sube para que otros lo oigan, pero el STT sigue siendo nativo.
- El TTS de las respuestas del tutor funciona igual que en 1 a 1 (opcional, con
  velocidad).
- Sin límite de participantes más allá del tamaño del grupo (5–10).

## Resolved questions

- Tope diario: se descuenta a quien disparó la respuesta del tutor (NFR-1); el
  recap final, al iniciador. — operador, 2026-10-06.
- Cualquier miembro (Free o Pro) puede iniciar; la sesión usa el combo del
  iniciador (NFR-2), así que los Free se benefician de una sesión abierta por
  un Pro. — operador, 2026-10-06.
- Las sesiones grupales entran en el resumen semanal (RF-6.3) solo como
  conteo de sesiones y XP, sin texto LLM nuevo. — operador, 2026-10-06.
- Sin programación a futuro: las sesiones se inician en el momento. —
  2026-10-06.

## Milestones

- M1 — Sala grupal por texto: iniciar, push de convocatoria, unirse/salir,
  mensajes en tiempo real, cierre y eventos básicos: FR-1, FR-2, FR-3, FR-4,
  FR-5, FR-6, FR-14.
- M2 — El tutor en el grupo: moderación, cadencia de respuesta, correcciones
  privadas/compartidas, nivel adaptado: FR-9, FR-10, FR-11, FR-12, FR-13.
- M3 — Voz y push de mensajes: notas de voz con transcripción, push agrupado:
  FR-7, FR-8.
- M4 — Progreso: recap, XP, streak, historial, brief: FR-15, FR-16, FR-17,
  FR-18.
