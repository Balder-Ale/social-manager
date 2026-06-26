# 📚  SOCIAL‑MANAGER – Guida per lo Sviluppo e l’Utilizzo                                                                                                                                       
                                                                                                                                                                                                   
   ## 1️⃣ Panoramica del progetto                                                                                                                                                                   
   **Social‑Manager** è un gestionale **multibrand** per la creazione, l’ottimizzazione e la pubblicazione di contenuti sui principali social (Instagram, Facebook, TikTok).                       
   Il sistema è costruito con:                                                                                                                                                                     
                                                                                                                                                                                                   
   | Componente | Scopo |                                                                                                                                                                          
   |------------|-------|                                                                                                                                                                          
   | **Docker‑Compose** | Avvia Postgres, Redis, MinIO (storage locale), backend Express/Next, runtime Pi‑agent e mock dei social. |                                                               
   | **Prisma** | ORM per PostgreSQL; modello multi‑tenant (tenant, user, brand, post, workflow, asset). |                                                                                         
   | **Pi‑agent** | Motore AI che esegue tutti i *sub‑agents* (trend, copy, media, QA, strategist). |                                                                                              
   | **OpenRouter** | Provider LLM gratuito (fino a 1 000 chiamate al giorno). |                                                                                                                   
   | **Next.js (frontend)** | UI moderna, tema automatico (light/dark), wizard *New Post*, *Brand Lab*, *Settings*, *Dashboard*. |                                                                 
   | **MSW mock** | Mock dei social per sviluppo locale (nessun OAuth richiesto). |                                                                                                                
   | **Feature flags** | `MOCK_SOCIAL`, `ENABLE_IMAGE_GEN`, `PORT` per attivare/disattivare funzionalità. |                                                                                        
                                                                                                                                                                                                   
   ## 2️⃣  Struttura delle cartelle                                                                                                                                                                 
                                                                                                                                                                                                   
 ```                                                                                                                                                                                               
                                                                                                                                                                                                   
 social-manager/                                                                                                                                                                                   
 │                                                                                                                                                                                                 
 ├─ .env.example            # template variabili d’ambiente (porta 4001, chiave OpenRouter, ecc.)                                                                                                  
 ├─ .gitignore                                                                                                                                                                                     
 ├─ Dockerfile              # build del backend (Node/TS)                                                                                                                                          
 ├─ Dockerfile.mock         # server mock dei social                                                                                                                                               
 ├─ docker-compose.yml                                                                                                                                                                             
 ├─ GUIDE.md                # ← questa guida                                                                                                                                                       
 ├─ TASKS.md                # ← lista dei task                                                                                                                                                     
 │                                                                                                                                                                                                 
 ├─ prisma/                                                                                                                                                                                        
 │   └─ schema.prisma       # modello DB (tenant, user, brand, post, workflow, asset)                                                                                                              
 │                                                                                                                                                                                                 
 ├─ src/                                                                                                                                                                                           
 │   ├─ index.ts            # entry‑point Express + Next.js                                                                                                                                        
 │   ├─ api/                # router REST/GraphQL (es. /api/analyze/trends)                                                                                                                        
 │   ├─ services/                                                                                                                                                                                  
 │   │   ├─ orchestrator/   # wrapper per il Master Agent                                                                                                                                          
 │   │   ├─ models/         # client OpenRouter                                                                                                                                                    
 │   │   └─ …               # auth, brand, integration, scheduler, analytics                                                                                                                       
 │   ├─ ui/                 # pagine Next.js (Brand Lab, New Post, Settings, Dashboard)                                                                                                            
 │   ├─ utils/              # storage (MinIO / R2), logger, helper functions                                                                                                                       
 │   ├─ scripts/                                                                                                                                                                                   
 │   │   ├─ seed-demo.ts    # crea tenant, admin e brand di esempio                                                                                                                                
 │   │   └─ demo-flow.ts    # chiama il Master Agent e stampa il risultato JSON                                                                                                                    
 │   └─ package.json        # dipendenze del frontend (express, dotenv, ecc.)                                                                                                                      
 │                                                                                                                                                                                                 
 ├─ pi/                                                                                                                                                                                            
 │   └─ agents/                                                                                                                                                                                    
 │       ├─ master.yaml         # definisce il flusso completo degli agenti                                                                                                                        
 │       ├─ trendHook.yaml      # ricerca trend + generazione hook                                                                                                                                 
 │       ├─ copy.yaml           # copywriting                                                                                                                                                      
 │       ├─ media.yaml          # generazione immagine/video                                                                                                                                       
 │       ├─ optimizer.yaml      # ottimizzazione per piattaforma                                                                                                                                   
 │       ├─ qa.yaml             # quality‑check rispetto a brand‑guidelines                                                                                                                        
 │       ├─ strategist.yaml     # growth‑playbook                                                                                                                                                  
 │       └─ image‑gen.yaml      # (opzionale) generazione immagini con Ollama/DALL‑E                                                                                                               
 │                                                                                                                                                                                                 
 └─ start.sh                # script di avvio locale (installazione, docker, seed, demo, UI)                                                                                                       
                                                                                                                                                                                                   
 ```                                                                                                                                                                                               
                                                                                                                                                                                                   
   ## 3️⃣  Flusso di lavoro tipico (utente)                                                                                                                                                         
                                                                                                                                                                                                   
   1. **Brand Lab** – crea o modifica l’identità del brand (nome, tone, palette, logo, linee guida).                                                                                               
   2. **New Post Wizard**                                                                                                                                                                          
      - Seleziona piattaforme, formato (reel, carousel, story, tweet, short)                                                                                                                       
 ```  