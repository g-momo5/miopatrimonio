# Mio Patrimonio (PWA iPhone)

PWA personale per tracciare patrimonio in EUR con:
- conti correnti + investimenti
- snapshot datati modificabili
- posizioni investimento manuali
- totali/subtotali e dashboard grafica
- obiettivi per categoria (totale, conti, investimenti)
- export/import (`JSON` + `CSV`)
- modalità offline in sola lettura
- istituti auto-creati durante la creazione conto

## Stack
- React + Vite + TypeScript
- Supabase (Auth email/password + Postgres)
- Recharts
- Vitest + Testing Library
- Playwright (scaffold E2E iPhone)

## Prerequisiti
- Node.js 20+
- Un progetto Supabase

## Setup locale
1. Installa dipendenze:
   ```bash
   npm install
   ```
2. Crea `.env` partendo da `.env.example`:
   ```env
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
3. Applica la migrazione SQL in Supabase:
   - file: `supabase/migrations/20260318_init.sql`
4. Avvia:
   ```bash
   npm run dev
   ```

## Script
- `npm run dev` - sviluppo
- `npm run build` - build produzione
- `npm run preview` - preview build
- `npm run test` - test unit/integration (watch)
- `npm run test:run` - test unit/integration (run singolo)
- `npm run test:e2e` - test E2E Playwright

## Deploy Vercel
1. Importa repository su Vercel.
2. Configura variabili ambiente (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
3. Build command: `npm run build`.
4. Output directory: `dist`.

## Catalogo istituti
Pool iniziale con principali istituti italiani e richiesti:
- Intesa Sanpaolo
- UniCredit
- Banco BPM
- BPER Banca
- Monte dei Paschi di Siena
- Fineco
- Credem
- BancoPosta
- ING Italia
- Banca Mediolanum
- Credit Agricole Italia
- Trade Republic
- BBVA

Per i preset usiamo logo locale bundled (`public/logos`) con fallback favicon web e, in ultima istanza, avatar con iniziali.

## Note PWA
- Manifest: `public/manifest.webmanifest`
- Service worker: `public/service-worker.js`
- iPhone standalone: meta tag e `apple-touch-icon` inclusi in `index.html`
