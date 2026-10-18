# Fluent 🎙️

**A voice-first English tutor that remembers you.**

Fluent is a mobile app for practicing conversational English in short, 10-minute sessions by speaking out loud with an AI tutor. The tutor isn't generic: it remembers what you told it ("how did Friday's interview go?"), knows the mistakes you keep making, and adapts every session. And you don't practice alone: you use it with your group of friends, with a leaderboard, streaks and challenges between you.

> A personal project with two goals: improve the English of a real group of friends, and serve as an end-to-end documented software architecture exercise.

---

## ✨ What it does

| | |
|---|---|
| 🗣️ **Voice conversation** | Native on-device STT and TTS (Android/iOS), no external audio services. You see the transcript before sending and can fix it. |
| ✍️ **Live corrections** | Each turn returns the tutor's reply and the corrections in the same call, streamed. Correction notes arrive in your language (es / pt-BR). |
| 🧠 **Real memory, no RAG** | When a session ends, a background job extracts personal facts and writes a *coaching brief*. You confirm what it remembers and can edit or delete it. |
| 📰 **Topics you care about** | Free topic, roleplays generated from 30 seed scenarios, or opinion prompts on news filtered by your interests (daily RSS). |
| 🔥 **Gamification** | XP, streaks with a grace day, levels, badges and *boss battles* outside your comfort zone. |
| 👥 **Social** | Weekly leaderboard, group streak, a weekly recap ready to paste into WhatsApp, and cross-challenges between friends. |

---

## 💸 Guiding principle: spend as little as possible on LLMs

Every product and architecture decision is subordinate to this:

- **One call per turn.** The model replies and corrects at once, with structured JSON output (`{reply, corrections[]}`).
- **One extra call per session, not per turn**, for the coaching brief, run in the background with BullMQ.
- **No RAG, no embeddings.** Each user's "knowledge" is small and structured: it fits entirely in the prompt.
- **Bounded history** to the last N turns and a fixed-size brief.
- **Free / Pro plans** with curated model combos through an LLM router, daily caps per plan and automatic fallback between models.

---

## 🏗️ Architecture

```
┌─────────────────────┐
│  Flutter (mobile)   │  Riverpod · go_router · dio · freezed
│  native STT/TTS     │  Google / Apple Sign-In · i18n es / pt-BR
└──────────┬──────────┘
           │ HTTPS + streaming
┌──────────▼──────────┐       ┌──────────────────────┐
│   NestJS 12 (API)   │──────▶│ LLM router (9router) │  free/pro combos
│  domain: sessions,  │       └──────────────────────┘  Vercel AI SDK + zod
│  XP, memory, groups │
└───┬────────────┬────┘
    │            │ BullMQ
    │     ┌──────▼──────────┐
    │     │ Worker + Redis  │  coaching brief · news · weekly recap · push
    │     └─────────────────┘
┌───▼──────────────────────┐
│ InsForge (self-hosted)   │  Auth · Postgres · Storage
└──────────────────────────┘

Fully self-hosted on a Hetzner VPS, deployed with Coolify. Mobile builds on Codemagic.
```

**Why this way** (every decision has its ADR in [`docs/adr`](docs/adr)):

- **BaaS + domain service** — InsForge handles auth, Postgres and storage; NestJS owns the business logic. ([ADR 0001](docs/adr/0001-baas-mas-servicio-de-dominio.md))
- **On-device voice** — low latency and zero audio cost. ([ADR 0003](docs/adr/0003-voz-nativa-en-el-dispositivo.md))
- **Separate API and worker** — BullMQ needs a persistent process; sessions need state and streaming. ([ADR 0004](docs/adr/0004-monorepo-y-despliegue-en-coolify.md))
- **LLM behind a router with plans** — the operator controls quality and budget without touching code. ([ADR 0005](docs/adr/0005-llm-via-9router-y-planes.md))

---

## 🧰 Stack

**Mobile:** Flutter · Dart · Riverpod · go_router · dio · freezed · speech_to_text · flutter_tts
**Backend:** NestJS 12 (ESM, Node 24) · TypeScript · Vercel AI SDK · zod · BullMQ · Redis · Pino · Swagger
**Data:** InsForge (Postgres, Auth, Storage)
**Infra:** Hetzner · Coolify · Docker · Codemagic (mobile CI/CD) · Firebase Cloud Messaging
**Quality:** Vitest · oxlint · Flutter tests

---

## 🤖 Built with an agentic workflow

Fluent was built with an AI-agent planning and execution pipeline, orchestrated by [**orch**](https://github.com/hectorcanaimero/orch), a tool I built:

```
PRD  →  Architecture  →  Specs  →  Task DAG  →  parallel agents (Claude · Codex · OpenCode · Gemini)
```

Every feature starts as a PRD with numbered, testable requirements ([`docs/prd`](docs/prd)), goes through an architecture doc ([`docs/arch`](docs/arch)) and ends as atomic specs ([`specs`](specs)) that `orch` dispatches as a dependency graph. Decisions live in ADRs, and requirements are traceable all the way to the code.

> Project docs are written in Spanish; the app ships in Spanish and Brazilian Portuguese.

---

## 📂 Structure

```
apps/
  api/       NestJS: HTTP API + job worker
  mobile/    Flutter: Android / iOS app
docs/
  PRD.md     Product requirements
  adr/       Architecture decision records
  prd/ arch/ Per-feature PRDs and architectures
  runbooks/  Operations
specs/       Agent-executable specs
```

---

## 🚀 Running locally

```bash
# Backend
pnpm install
cp apps/api/.env.example apps/api/.env   # fill in InsForge, Redis and LLM settings
pnpm api start:dev                       # API
pnpm api start:worker                    # worker (after build)
pnpm test

# Mobile
cd apps/mobile
flutter pub get
flutter run
```

---

## 🗺️ Roadmap

- [x] Voice sessions with streamed corrections
- [x] User-confirmed memory and coaching brief
- [x] Gamification and social (leaderboard, streaks, weekly recap)
- [x] Free / Pro plans and LLM router
- [x] Google / Apple sign-in, i18n es / pt-BR
- [ ] **Group session**: several friends talking at once with the tutor as moderator ([PRD](docs/prd/002-sesion-grupal.md))

---

Made by [Héctor Alejandro](https://github.com/hectorcanaimero).
