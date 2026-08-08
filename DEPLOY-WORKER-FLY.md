# Deploy the ingest worker on Fly.io

Runs [`scripts/ingest-worker.ts`](scripts/ingest-worker.ts) as an always-on background
process — the same ingestion engine as the Vercel cron, but with no serverless
timeout, so it can mill through thousands of brands and keep them refreshed weekly.

It has **no HTTP server / no public port** — it just loops over "due" brands
(pending/failed + active brands overdue for their weekly re-check) and fills in ads.

Files already in the repo: [`Dockerfile.worker`](Dockerfile.worker), [`fly.toml`](fly.toml),
and the `worker` npm script.

---

## 1. Install the CLI + log in
```bash
brew install flyctl        # or: curl -L https://fly.io/install.sh | sh
fly auth login
```

## 2. Create the app
```bash
fly apps create greatearth-ingest-worker
```
(If the name is taken, pick another and update `app = ` in `fly.toml`.)

## 3. Set the secrets
Only two are required to start; add more tokens for more throughput.
```bash
fly secrets set \
  DATABASE_URL='<same Neon URL as Vercel>' \
  FACEBOOK_ACCESS_TOKEN1='<your never-expiring token>' \
  -a greatearth-ingest-worker
```
Add extra tokens once you've renewed them (each one ≈ +1× throughput):
```bash
fly secrets set FACEBOOK_ACCESS_TOKEN2='<token>' FACEBOOK_ACCESS_TOKEN3='<token>' -a greatearth-ingest-worker
```
> Tip: use a **System User** token (never expires) so you never have to do the
> token dance again — see the Meta Business settings.

## 4. Deploy
```bash
fly deploy -a greatearth-ingest-worker
```
This builds `Dockerfile.worker` and starts one machine running the worker.

## 5. Watch it run
```bash
fly logs -a greatearth-ingest-worker
```
You should see `TokenManager initialized with N token(s)` and
`✓ <brand>` lines as brands are processed.

---

## Tuning (env — edit in `fly.toml` or `fly secrets set`)
| Var | Default | What it does |
|---|---|---|
| `CONCURRENCY` | 2 | brands processed in parallel |
| `PACE_MS` | 2000 | delay between dispatching brands (rate-limit safety) |
| `BATCH` | 24 | due-brands fetched per DB round |
| `POLL_MS` | 60000 | sleep when the queue is momentarily empty |

**Scale up throughput** once you have more Meta tokens:
```bash
fly secrets set FACEBOOK_ACCESS_TOKEN2=... FACEBOOK_ACCESS_TOKEN3=... -a greatearth-ingest-worker
# then raise concurrency:
fly deploy -a greatearth-ingest-worker   # after bumping CONCURRENCY in fly.toml (e.g. 4–6)
```
Rule of thumb: keep `CONCURRENCY` ≲ number of valid tokens × 2, or Meta will
rate-limit (the engine backs off automatically, but you waste time).

## Cost
One `shared-cpu-1x` / 512 MB machine runs ~$2–4/month. It's a single always-on
process; no scaling needed until you're pushing millions of ads.

## Notes
- **Idempotent** — safe to run exactly one instance. Don't run two (they'd double-process).
- The worker + the Vercel `discover` cron form the loop: discovery adds new brands
  (pending) → the worker backfills them and refreshes existing ones weekly.
- Classification (Kimi) is separate — run [`scripts/classify-kimi.ts`](scripts/classify-kimi.ts)
  for the backlog, or add a second Fly process/cron for it later.
- Restart the machine anytime: `fly machine restart -a greatearth-ingest-worker`.
- Stop billing: `fly scale count 0 -a greatearth-ingest-worker` (or `fly apps destroy`).
