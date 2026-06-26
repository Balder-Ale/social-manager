# ✅ TASKS – Stato di avanzamento di Social‑Manager

**Legenda**
- **✅ Completato** – già implementato e funzionante.
- **🔧 In corso** – in fase di test o pronta all’uso ma non ancora pienamente verificata.
- **🚀 Da fare** – prossimo passo da implementare.
- **⚙️ Priorità** – `high` (critica), `medium` (importante) o `low` (nice‑to‑have).

---

## ✅ Completato

| # | Task | Note |
|---|------|------|
| 1 | Creazione della struttura del monorepo (`social‑manager/`) | Cartelle `src`, `pi`, `prisma`, Dockerfile, ecc. |
| 2 | File `docker-compose.yml` (Postgres, Redis, MinIO, backend, pi‑agent, mock) | Tutti i container avviabili localmente. |
| 3 | Schema Prisma `schema.prisma` (tenant, user, brand, post, workflow, asset) | Migrazioni già testate. |
| 4 | Script `start.sh` (installazione dipendenze, avvio Docker, seed, demo‑flow, avvio UI) | Aggiornato per usare `pnpm` dentro `src/`. |
| 5 | File di esempio `.env.example` (porta 4001, flag, placeholder OpenRouter) | Pronto per essere copiato in `.env`. |
| 6 | Backend minimale (`src/index.ts`) – Express + Next.js wrapper | Health‑check, endpoint `/api/analyze/trends`. |
| 7 | Sub‑agents Pi (master.yaml, trendHook.yaml, copy.yaml, media.yaml, optimizer.yaml, qa.yaml, strategist.yaml) | Definiti ma senza payload complessi (usano OpenRouter). |
| 8 | Mock dei social (MSW) – risponde a Instagram, Facebook, TikTok | Permette testing senza OAuth. |
| 9 | Script di seed demo (`src/scripts/seed-demo.ts`) | Crea tenant “DemoTenant”, admin e brand di esempio. |
|10 | Script demo‑flow (`src/scripts/demo-flow.ts`) | Esegue l’intera pipeline e stampa JSON. |
|11 | Front‑end Next.js con pagina placeholder (Home) | Avviabile con `pnpm dev` dentro `src/`. |
|12 | UI di **Brand Lab** | Form per nome, tone, palette, logo, linee guida. Collegato a `POST /api/brands`. |
|13 | UI di **New Post Wizard** | Interfaccia a 3 step che chiama `/api/analyze/trends`, mostra trend e hook, bottone Confirm & Publish. |
|14 | UI di **Settings** | Pagina per inserire chiave OpenRouter (localStorage + backend runtime) + sezione Connected Social Accounts. |
|15 | Integrazione **OAuth reale** per Instagram/Facebook/TikTok | Model `SocialAccount`, migrazione DB, servizio OAuth, API routes (authorize, callback, accounts CRUD), UI connessione. |
|16 | **Unit / Integration tests** (Jest) | 32 test su 4 suite: oauth, routes API, seed-demo, demo-flow. |
| 17 | **CI/CD** – GitHub Actions (lint + test) | Git init, primo commit, `.github/workflows/ci.yml` creato. |

---

## 🚀 Da fare

| # | Task | Descrizione | Priorità |
|---|------|------------|----------|
| 18 | **Abilitare `image‑gen`** sub‑agent | Installare Ollama, configurare `ENABLE_IMAGE_GEN=true`, aggiungere UI per scegliere modello immagine. | low |
| 19 | **Deploy su Fly.io (free tier)** | Creare app Fly.io, impostare secret (OpenRouter, R2), `fly deploy`. ✅ App live su https://social-manager2026.fly.dev/ (health OK, DB connesso) | high |
| 20 | **Passare a Cloudflare R2** | Aggiornare `.env` con `STORAGE_PROVIDER=r2` e credenziali; test upload/download. ✅ `storage.ts` refactorizzato per supportare MinIO e R2. `.env.example` aggiornato con vars R2. | medium |
| 21 | **Gestione multi-brand (prod)** | UI per switch tenant, isolamento DB (schema o `tenant_id`). ✅ Tenant middleware (`X-Tenant-Id` header), API CRUD tenants, tenant switcher UI nel layout, brand/oauth queries scoped. | high |
| 22 | **Cache trend + hook** (Redis) | Implementare TTL 10 min, `stale‑while‑revalidate`. ✅ `src/utils/cache.ts` creato, integrato in `/api/analyze/trends` con background refresh. | medium |
| 23 | **Report “Growth Playbook”** | UI per visualizzare analisi strategica. | low |