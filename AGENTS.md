# Istruzioni globali del progetto

## Lingua

**Rispondi SEMPRE in italiano.** Tutte le comunicazioni con l'utente, i commenti al codice non strettamente tecnici, i riassunti, i piani e le spiegazioni devono essere in italiano. Il codice, i nomi di variabili/funzioni e i termini tecnici standard restano in inglese come da convenzione.

## Struttura del progetto

- `social-manager/` — applicazione principale (Node.js + Next.js)
  - `src/web/` — frontend Next.js (vedi il suo `AGENTS.md` per le regole Next.js)
  - `prisma/` — schema e migrazioni del database
  - `pi/agents/` — definizione degli agenti del pipeline di creazione contenuti
- `prisma/` — schema Prisma condiviso (root)
- `GUIDE.md` / `TASKS.md` — guida e lista attività del progetto
