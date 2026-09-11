# Product Marketing Context

**Document version:** v1
**Last updated:** 2026-09-11

## Product Overview
**One-liner:** Practicá inglés hablado 10 minutos al día con un tutor de IA que se acuerda de vos, compitiendo con tus amigos.
**What it does:** App móvil (Flutter) de conversación por voz en inglés. Tutor con memoria entre sesiones, correcciones en la misma respuesta, XP, rachas, ranking semanal del grupo y resumen semanal para compartir por WhatsApp.
**Product category:** práctica de inglés conversacional (speaking) con IA.
**Product type:** app móvil de consumo, grupo cerrado por invitación.
**Business model:** sin monetización en v1. BYOK: cada usuario conecta su cuenta gratuita de OpenRouter o Gemini; el operador no paga LLM.
**Etapa:** v1 privada para 5–10 amigos. Nombre de trabajo "Fluent", sin verificar en tiendas.

## Target Audience
**Público:** adultos hispanohablantes y brasileños, nivel A2–B2, que tienen 10 minutos y no una hora.
**Primary use case:** hablar inglés todos los días sin profesor ni clase, con correcciones y sin vergüenza.
**Jobs to be done:**
- Perder el miedo a hablar con práctica corta y diaria.
- Ver que mejoro (errores que bajan), no solo acumular puntos.
- Sostener el hábito con mis amigos, no solo.
**Registro lingüístico:** voseo en español (decisión v1, ya en la app y en `docs/reglas.md`); pt-BR informal. Si se abre al público general, pasar el español a tuteo neutro.

## Problems & Pain Points
**Core problem:** las apps de idiomas enseñan a leer y tocar, no a hablar; las clases de conversación son caras y a horario fijo.
**Why alternatives fall short:** Duolingo es juego sin habla; ELSA/Speak hablan pero no recuerdan nada del usuario y cobran suscripción; ChatGPT por voz recuerda a medias, sin juego ni amigos.
**Emotional tension:** vergüenza de hablar mal, sensación de no avanzar, abandono a la segunda semana.

## Differentiation
**Key differentiators (en este orden):**
1. Memoria del tutor con control total del usuario ("Lo que recuerdo de vos", editable).
2. Social entre amigos, no contra extraños: ranking semanal, racha grupal, desafíos cruzados.
3. 10 minutos, dos veces al día.
4. Sin coste ni suscripción: tu propia cuenta gratuita de IA.
**Aha moment:** primera sesión válida (≥3 min, ≥2 turnos) con al menos una corrección y XP. Aha secundario: primera apertura con callback ("¿cómo te fue en…?").

## Customer Language
**Words to use:** hablar, conversación, se acuerda de vos, tus amigos, racha, 10 minutos, tu cuenta, corrección.
**Words to avoid:** fluidez garantizada, nativo en X semanas, gamificación, IA revolucionaria, aprende (usar "practicá"), premium/plus, lecciones, curso.

## Brand Voice
**Tone:** cercano, directo, sin épica. Frases cortas. Humor suave en el resumen semanal. Nunca infantil.

## Privacy as a promise
Solo texto, nunca audio. Hechos editables por el usuario. Los amigos ven XP, racha y temas; nunca conversaciones ni correcciones.

## Goals
**Business goal:** que el grupo practique de verdad: ≥8 sesiones válidas por usuario por semana (PRD); activos semanales ≥70 % del grupo.
**Conversion action:** primera sesión válida el mismo día del registro.
**Canales v1:** WhatsApp del grupo (resumen semanal, invitaciones). Sin web, dominio ni tiendas todavía.

## Changelog
*Newest first. One line per revision: what changed and why.*
- v1 (2026-09-11) — Contexto inicial, a partir del PRD y de la auditoría del peine fino (MEJ-43).
