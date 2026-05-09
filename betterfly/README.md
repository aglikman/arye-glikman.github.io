# BetterFly Smart Clinical System

Secure clinical SaaS platform for intake, scoring, DSM-aligned interpretation, dashboard review, report generation, and follow-up tracking. Bilingual (English + Hebrew).

## Architecture

```
betterfly/
├── apps/
│   ├── api/          # Fastify + TypeScript + PostgreSQL (port 3001)
│   └── web/          # Next.js 15 + Tailwind CSS (port 3000)
└── packages/
    └── shared/       # Shared TypeScript types + Zod schemas
```

## Quick Start

### Prerequisites
- Node.js ≥ 20
- Docker (for local Postgres + Redis)

### 1. Start infrastructure

```bash
docker compose up -d
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

### 4. Run the DB schema

```bash
psql postgresql://betterfly:betterfly_dev@localhost:5432/betterfly_db \
  -f apps/api/src/db/schema.sql
```

### 5. Start development servers

```bash
npm run dev
```

- Web: http://localhost:3000
- API: http://localhost:3001
- MailHog: http://localhost:8025

## Key Features

| Feature | Status |
|---|---|
| Secure intake form with expiring token | ✅ Scaffolded |
| Bilingual (EN/HE) questionnaire rendering | ✅ Scaffolded |
| Informed consent with version tracking | ✅ DB + API |
| Automatic domain scoring engine | ✅ Implemented |
| DSM-aligned interpretation engine | ✅ Implemented |
| Risk alert detection and display | ✅ Implemented |
| Clinician dashboard with score cards | ✅ Scaffolded |
| Progress timeline charts | ✅ Scaffolded |
| Report builder (sections, clinician edit) | ✅ Scaffolded |
| Report approval workflow | ✅ API implemented |
| PDF generation | 🔲 Needs Puppeteer template |
| QEEG module | 🔲 DB ready, needs UI |
| MFA | 🔲 Planned |
| Email delivery | 🔲 Nodemailer wired |

## Clinical Disclaimer

This system provides structured screening and interpretation support. It does not replace professional diagnosis. All outputs must be reviewed by a qualified clinician.
