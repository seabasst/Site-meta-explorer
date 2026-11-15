---
name: meta-vertical-benchmark
description: Compare a Meta (Facebook/Instagram) ad account against its industry on how long ads run, how fast they are stopped, how many survive past 60 days and how many new ads launch per week, using KiriMedia's free benchmark MCP built from the Meta Ad Library. Then ties lifespan to margin so the advice is about profit, not platform ROAS. Use when the user asks how their ad account compares to the industry, whether they kill ads too fast or too slowly, how long winning ads usually run, what testing volume is normal for their vertical, or says "benchmark my Meta account", "jämför mitt annonskonto med branschen", "stänger vi av annonser för snabbt", "hur länge brukar annonser gå".
---

# Meta account vs industry benchmark

Answer in the user's language. Tables before prose. Never invent numbers, benchmarks or industry averages: every comparison figure comes from the MCP, every account figure from the user's data. Label estimates with their assumption and phrase unsupported conclusions as hypotheses with a test.

## 0. Check the MCP

The tools `list_verticals` and `get_vertical_benchmark` come from the `kiri-benchmarks` MCP server. If they are missing, stop and tell the user:

1. Read and accept the terms at https://genome.kirimedia.co/mcp/terms and request a key there.
2. Connect it: `claude mcp add --transport http kiri-benchmarks https://genome.kirimedia.co/api/mcp --header "Authorization: Bearer <key>"`

The MCP only receives the vertical and tier. The account's data never leaves the user's machine. Keep it that way: do not send account figures to any tool.

## 1. Pick the vertical

Call `list_verticals`. If the account's industry is not listed, say so and stop. Do not compare against a neighbouring vertical without the user's explicit OK, and label it if they agree.

Call `get_vertical_benchmark` without a tier once to read `cohort.started_from`, the tier bounds, `definitions` and `caveats`.

## 2. Get the account's daily ad-level delivery

Needed: one row per ad per day from 30 days before `cohort.started_from` until yesterday. The 30 extra days keep ads that started earlier from being counted as new.

Normalise to a CSV with these headers: `ad_id,ad_name,date,impressions,spend,purchases,revenue` (`purchases` and `revenue` optional).

**Option A, Marketing API** (the user supplies a token with `ads_read`):

```bash
curl -G "https://graph.facebook.com/v22.0/act_<ACCOUNT_ID>/insights" \
  --data-urlencode 'level=ad' --data-urlencode 'time_increment=1' --data-urlencode 'limit=500' \
  --data-urlencode 'fields=ad_id,ad_name,impressions,spend,actions,action_values' \
  --data-urlencode 'time_range={"since":"<FROM>","until":"<YESTERDAY>"}' \
  --data-urlencode "access_token=$META_TOKEN"
```

Follow `paging.next` until it ends. `date` is `date_start`. Purchases and revenue are the `purchase` entries in `actions` and `action_values`. For large accounts use an async report (POST the same parameters, poll `report_run_id`). Record the account's attribution setting: it applies to `purchases` and `revenue`.

**Option B, Ads Manager export:** Ads tab, date range as above, Breakdown: By time > Day, columns Ad ID, Ad name, Impressions, Amount spent, Purchases, Purchases conversion value. Export CSV and rename the columns to the headers above.

## 3. Compute the account's metrics

```bash
python3 <skill-dir>/scripts/account_metrics.py daily.csv --cohort-start <cohort.started_from> --until <last day in data> > metrics.json
```

The definitions are the same as the benchmark's (`definitions` in the MCP response). Read `note` if present: with fewer than 10 cohort ads the lifespan metrics are not comparable, so say so and only report launch volume and live ads.

## 4. Compare

Pick the tier whose `launches_per_week` bounds contain the account's `launches_per_week`, call `get_vertical_benchmark` with that tier, and build this table:

| Metric | Account | Peers p25 | p50 | p75 | Position |
|---|---|---|---|---|---|

Position is one of: below p10, p10 to p25, p25 to p50, p50 to p75, p75 to p90, above p90. State the number of brands in the tier, the countries and the pull dates under the table. A `median_lifespan_days` of 61 means more than half of the ads were still running at day 60.

## 5. Tie lifespan to margin

Lifespan is not profit. `metrics.json` has `lifespan_buckets` (stopped in 1 to 7 days, 8 to 30, 31 to 60, ran past 60) with spend, purchases and revenue per bucket.

- Ask for the gross margin (GM1, and fulfilment and payment costs for GM2) if you do not have it. Never assume one.
- With margin: contribution per bucket = revenue × margin − spend. Say which margin level you used.
- Without margin: show the spend share per bucket and revenue as context only, name the attribution (window, model, source, date range), and say the margin is missing.
- Platform ROAS can appear as context, never as the main metric.

## 6. Findings and recommendations

Read the comparison with these rules, and always test them against the account's own buckets before recommending anything:

| Pattern | What it can mean | Check in the account |
|---|---|---|
| `stopped_by_day_7` above peer p75 | Stops ads faster than three in four peers | Spend per ad in the 1 to 7 day bucket. If it is below the account's own CPA, the ads were stopped before they could prove anything |
| `running_after_day_60` below peer p25 | Few long runners | Contribution of the ran-past-60 bucket. If it carries the margin, iterate on those ads |
| `launches_per_week` below tier p25 | Lower testing volume than peers of the same size | Whether new ads have positive contribution at all before scaling volume |
| `stopped_by_day_7` below peer p25 | Keeps weak ads running | Contribution of ads that stopped after 31 to 60 days |

Then give at most five recommendations, ranked. Each one has: the action, the expected effect (an estimate with its assumption written out, or a hypothesis with how to test it), and what it takes to do it. Close with the caveats from the MCP response.

If the user wants a report for a client or team, deliver it as an HTML page, not Markdown.
