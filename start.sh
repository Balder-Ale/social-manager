#!/usr/bin/env bash
# --------------------------------------------------------------
# start.sh – avvia l'intero stack locale e apre il browser
# --------------------------------------------------------------

set -e

# --------------------------------------------------------------
# 1️⃣  Controlla .env (crea da .env.example se mancante)
# --------------------------------------------------------------
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo "✅  .env creato da .env.example – sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
  else
    echo "❌  Nessun file .env né .env.example trovati. Creane uno manualmente." >&2
    exit 1
  fi
fi

# Apri l'editor per inserire la chiave (solo la prima volta)
if grep -q "YOUR_OPENROUTER_API_KEY" .env; then
  echo "🛠️  Inserisci la tua chiave API OpenRouter nel file .env"
  if [[ "$OSTYPE" == "darwin"* ]]; then
    open -a TextEdit .env
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open .env || nano .env
  else
    notepad .env
  fi
  echo "🛑  Dopo aver salvato, ri‑esegui ./start.sh"
  exit 0
fi

# --------------------------------------------------------------
# 2️⃣  Installa le dipendenze (pnpm) – eseguite nella cartella src
# --------------------------------------------------------------
echo "📦  Installazione dipendenze..."
# Esegui pnpm dentro src per usare il package.json corretto
(cd src && npx pnpm install)

# Copia .env dentro la cartella src così il server Next lo legge
cp .env src/.env

# --------------------------------------------------------------
# 3️⃣  Avvia Docker Compose (in background)
# --------------------------------------------------------------
echo "🐳  Avvio dei container Docker..."
docker compose up -d

# --------------------------------------------------------------
# 4️⃣  Attendi che i servizi siano pronti
# --------------------------------------------------------------
echo "⏳  Attendo che Postgres, Redis e MinIO siano pronti..."
# Postgres
until docker exec $(docker compose ps -q postgres) pg_isready -U pi; do sleep 1; done
# Redis
until docker exec $(docker compose ps -q redis) redis-cli ping | grep PONG; do sleep 1; done
# MinIO health
until curl -sf http://localhost:9000/minio/health/live; do sleep 1; done

echo "✅  Servizi di base pronti!"

# --------------------------------------------------------------
# 5️⃣  Migrazioni Prisma
# --------------------------------------------------------------
echo "🗄️  Applicazione migrazioni DB..."
# Prisma genera client
npx prisma generate
# Applica eventuali migration pendenti (non interattivo)
npx prisma migrate deploy

# --------------------------------------------------------------
# 6️⃣  Seed demo data
# --------------------------------------------------------------
echo "🌱  Creazione dati demo (tenant + brand)..."
npx pnpm run seed

# 7️⃣  Demo flow (mostra output nella console)
# --------------------------------------------------------------
echo "🤖  Esecuzione del flusso demo (analisi + creazione post)..."
npx pnpm --dir src run demo

# --------------------------------------------------------------
# 8️⃣  Avvia il server di sviluppo backend
# --------------------------------------------------------------
echo "🚀  Avvio del server di sviluppo backend in locale..."
npx pnpm --dir src run dev &
BACKEND_PID=$!

# --------------------------------------------------------------
# 9️⃣  Avvia il frontend Next.js
# --------------------------------------------------------------
echo "🟦  Avvio del frontend Next.js..."
(cd src/web && PORT=4001 npm run dev) &
FRONTEND_PID=$!

# Attendi che entrambi i servizi siano pronti
echo "⏳  Attendo che il frontend sia pronto..."
# Attendi qualche secondo e poi verifica che il frontend risponda
until curl -sf http://localhost:4001 > /dev/null; do
  sleep 1
done
echo "✅  Frontend pronto!"

# Apri il browser sul frontend
echo "🌐  Apertura del browser su http://localhost:4001..."
if [[ "$OSTYPE" == "darwin"* ]]; then
  open http://localhost:4001
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  xdg-open http://localhost:4001 || true
fi

# Rimani in ascolto dei log del backend (il frontend rimane in background)
wait $BACKEND_PID