# Prisma Migrations — Baseline Instructions

## Context

Until Phase 1 of the 2026-04-18 audit, this project had **no migration history**.
The shared Neon Postgres database was evolved via `prisma db push` from local
machines, with no rollback path, no audit trail, and no review surface for
schema changes.

This directory was created as part of Phase 1.1 to fix that. The initial
migration (`20260418000000_init/migration.sql`) was generated with:

```bash
npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script
```

It represents the **current shape of the shared Neon database** as of the
baseline commit. Do **not** edit it by hand.

---

## One-time baseline (do this once, against Neon)

The shared Neon database already has all these tables. You do NOT want Prisma
to re-create them. The `migrate resolve --applied` command tells Prisma
"this migration is already applied; just record it in `_prisma_migrations`".

**Steps:**

1. Confirm you have a recent Neon backup / snapshot before doing anything.
2. Ensure `DATABASE_URL` in `.env.local` points at Neon (the shared prod DB).
3. Run the baseline:

   ```bash
   npx prisma migrate resolve --applied 20260418000000_init
   ```

4. Verify:

   ```bash
   npx prisma migrate status
   ```

   Expected output: `Database schema is up to date!` with one applied migration.

5. Commit nothing new — the baseline is metadata-only in Neon.

---

## From here on

**Every schema change goes through `prisma migrate dev`:**

```bash
# 1. Edit prisma/schema.prisma
# 2. Generate migration + apply to local / Neon
npx prisma migrate dev --name "descriptive_name"
# 3. Commit the new prisma/migrations/<timestamp>_descriptive_name/ folder
# 4. Review the generated SQL before pushing
```

**Do NOT run `prisma db push` against prod again.** If you need a quick local
iteration against a throwaway DB, use `--skip-generate --accept-data-loss` on
a separate local Postgres only.

---

## Phase 2 schema changes that need migrations

Listed in `.planning/review-2026-04-18/00-SYNTHESIS.md`:

- **Phase 2.1** — drop `BrandProfile.isActive`, add `User.activeBrandProfileId` FK
- **Phase 2.3** — add `HikaruChat` + `HikaruMessage` models (currently broken)
- **Phase 2.4** — add `ManusTask.userId` FK + index
- **Phase 2.5** — add FK relations on `RoadmapRequest.userId` / `RoadmapUpvote.userId`

Each should be its own `prisma migrate dev` invocation with a clear name.
