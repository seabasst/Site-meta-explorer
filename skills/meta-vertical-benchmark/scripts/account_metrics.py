#!/usr/bin/env python3
"""Ad lifespan metrics for one Meta ad account, computed exactly like the vertical benchmark.

Input: CSV, one row per ad per day, headers (extra columns are ignored):
  ad_id, date (YYYY-MM-DD), impressions, spend   required
  ad_name, purchases, revenue                    optional
Usage:
  python3 account_metrics.py daily.csv --cohort-start 2026-06-01 [--until 2026-11-10] > metrics.json
  python3 account_metrics.py --selftest
Definitions mirror scripts/benchmarks/vertical-benchmark.mjs (brandMetrics) in the Genome repo.
One difference: daily data cannot tell "stopped on the last day" from "still running", so an ad that
delivered on --until counts as live. That only moves live_ads_now; cohort ads are 60+ days old either way.
"""
import csv, json, math, sys
from datetime import date, timedelta

OBSERVE_DAYS = 60
MIN_COHORT_ADS = 10
BUCKETS = [(1, 7, 'stopped_1_7d'), (8, 30, 'stopped_8_30d'), (31, 60, 'stopped_31_60d'), (61, math.inf, 'ran_past_60d')]


def num(x):
    try:
        return float(str(x).replace(',', '').replace(' ', '') or 0)
    except ValueError:
        return 0.0


def per_ad(rows):
    """Collapse daily rows to one record per ad, counting only days with delivery."""
    ads = {}
    for r in rows:
        if num(r.get('impressions')) <= 0 and num(r.get('spend')) <= 0:
            continue
        d = date.fromisoformat(r['date'][:10])
        a = ads.setdefault(r['ad_id'], {'ad_id': r['ad_id'], 'ad_name': r.get('ad_name', ''), 'first': d, 'last': d,
                                         'spend': 0.0, 'purchases': 0.0, 'revenue': 0.0})
        a['first'], a['last'] = min(a['first'], d), max(a['last'], d)
        for k in ('spend', 'purchases', 'revenue'):
            a[k] += num(r.get(k))
    return list(ads.values())


def metrics(rows, cohort_start, until=None):
    ads = per_ad(rows)
    if not ads:
        raise SystemExit('No rows with delivery')
    data_from = min(r['date'][:10] for r in rows)
    until = until or max(a['last'] for a in ads)
    data_from = date.fromisoformat(data_from)
    lifespans, table = [], []
    live_now = launched_13w = 0
    for a in ads:
        running = a['last'] >= until
        left_censored = a['first'] <= data_from  # may have started before the export window
        life = math.inf if running else (a['last'] - a['first']).days + 1
        in_cohort = not left_censored and cohort_start <= a['first'] <= until - timedelta(days=OBSERVE_DAYS)
        live_now += running
        launched_13w += (not left_censored) and a['first'] > until - timedelta(days=91)
        if in_cohort:
            lifespans.append(life)
        table.append({**a, 'first': a['first'].isoformat(), 'last': a['last'].isoformat(),
                      'lifespan_days': None if running else life, 'still_running': running, 'in_cohort': in_cohort})
    out = {'until': until.isoformat(), 'data_from': data_from.isoformat(), 'cohort_start': cohort_start.isoformat(),
           'cohort_ads': len(lifespans), 'launches_per_week': launched_13w / 13, 'live_ads_now': live_now}
    if len(lifespans) >= MIN_COHORT_ADS:
        stopped_by = lambda d: sum(l <= d for l in lifespans) / len(lifespans)
        out.update({f'stopped_by_day_{d}': stopped_by(d) for d in (3, 7, 14, 30)})
        out['running_after_day_60'] = 1 - stopped_by(OBSERVE_DAYS)
        out['median_lifespan_days'] = next((d for d in range(1, OBSERVE_DAYS + 1) if stopped_by(d) >= 0.5), None)
    else:
        out['note'] = f'Fewer than {MIN_COHORT_ADS} cohort ads: lifespan metrics not comparable with the benchmark.'
    cohort = [t for t in table if t['in_cohort']]
    out['lifespan_buckets'] = []
    for lo, hi, name in BUCKETS:
        b = [t for t in cohort if lo <= (t['lifespan_days'] or math.inf) <= hi]
        out['lifespan_buckets'].append({'bucket': name, 'ads': len(b), 'spend': round(sum(t['spend'] for t in b), 2),
                                        'purchases': round(sum(t['purchases'] for t in b), 2),
                                        'revenue': round(sum(t['revenue'] for t in b), 2)})
    out['ads'] = sorted(table, key=lambda t: t['first'])
    return out


def selftest():
    # Same fixture as the benchmark selftest: until 2026-11-10, cohort from 2026-06-01.
    spans = [('2026-07-01', '2026-07-02'), ('2026-07-01', '2026-07-20'), ('2026-07-01', '2026-11-10'),
             ('2026-10-01', '2026-11-10')] + [('2026-07-05', '2026-07-05')] * 7
    rows = [{'ad_id': 'early', 'date': '2026-05-01', 'impressions': '5', 'spend': '1'}]  # sets data_from, left-censored
    for i, (s, e) in enumerate(spans):
        for d in (s, e):
            rows.append({'ad_id': str(i), 'date': d, 'impressions': '10', 'spend': '2'})
    m = metrics(rows, date(2026, 6, 1), date(2026, 11, 10))
    assert m['cohort_ads'] == 10, m
    assert abs(m['stopped_by_day_3'] - 0.8) < 1e-9, m
    assert abs(m['stopped_by_day_30'] - 0.9) < 1e-9, m
    assert abs(m['running_after_day_60'] - 0.1) < 1e-9, m
    assert m['median_lifespan_days'] == 1 and m['live_ads_now'] == 2, m
    assert abs(m['launches_per_week'] - 1 / 13) < 1e-9, m
    assert [b['ads'] for b in m['lifespan_buckets']] == [8, 1, 0, 1], m['lifespan_buckets']
    print('selftest ok')


if __name__ == '__main__':
    args = sys.argv[1:]
    if args[:1] == ['--selftest']:
        selftest()
        sys.exit()
    opt = lambda k: args[args.index(k) + 1] if k in args else None
    if not args or not opt('--cohort-start'):
        sys.exit(__doc__)
    with open(args[0], newline='', encoding='utf-8-sig') as f:
        rows = list(csv.DictReader(f))
    until = date.fromisoformat(opt('--until')) if opt('--until') else None
    json.dump(metrics(rows, date.fromisoformat(opt('--cohort-start')), until), sys.stdout, indent=1, default=str)
