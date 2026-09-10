-- P2: modelled layer over the raw_* mirror. Views (always current with the
-- nightly sync; BigQuery prunes unused columns so JSON parsing only runs when
-- market columns are selected). Materialise fact_ad as a table later if scans slow.
-- Re-run: bq query --use_legacy_sql=false < scripts/bq-p2-model.sql

CREATE OR REPLACE VIEW ad_intel.dim_brand AS
SELECT
  id            AS brand_id,
  pageId        AS page_id,
  pageName      AS brand_name,
  category,
  country,
  website,
  totalReach    AS total_reach,
  ingestionStatus AS ingestion_status,
  priority,
  lastCheckedAt AS last_checked_at,
  createdAt     AS first_seen_at
FROM ad_intel.raw_brands;

CREATE OR REPLACE VIEW ad_intel.fact_ad AS
SELECT
  a.id          AS ad_pk,
  a.adId        AS ad_id,
  a.brandId     AS brand_id,
  a.displayFormat AS format,
  a.publisherPlatforms AS platforms,
  a.body        AS ad_copy,
  a.title,
  a.caption     AS display_domain,
  a.linkUrl     AS landing_url,
  a.ctaText     AS cta_text,
  a.ctaType     AS cta_type,
  a.bylines,
  a.startDate   AS start_date,
  a.endDate     AS end_date,
  a.adDurationDays AS duration_days,
  a.isActive    AS is_active,
  a.reachEstimate AS reach,
  a.spendLower  AS spend_lower,
  a.spendUpper  AS spend_upper,
  a.currency,
  JSON_VALUE(a.targetingJson, '$.targetGender') AS target_gender,
  SAFE_CAST(JSON_VALUE(a.targetingJson, '$.targetAges[0]') AS INT64) AS age_min,
  SAFE_CAST(JSON_VALUE(a.targetingJson, '$.targetAges[1]') AS INT64) AS age_max,
  JSON_VALUE_ARRAY(a.targetingJson, '$.languages') AS languages,
  ARRAY(
    SELECT JSON_VALUE(loc, '$.name')
    FROM UNNEST(JSON_QUERY_ARRAY(a.targetingJson, '$.targetLocations')) loc
  ) AS target_countries,
  a.createdAt   AS ingested_at,
  a.updatedAt   AS updated_at
FROM ad_intel.raw_ads a;

CREATE OR REPLACE VIEW ad_intel.mart_brand_velocity AS
WITH v AS (
  SELECT brand_id,
    COUNTIF(start_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY))  AS new_ads_7d,
    COUNTIF(start_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)) AS new_ads_30d
  FROM ad_intel.fact_ad
  GROUP BY brand_id
)
SELECT
  b.brand_name, b.category, b.country, b.total_reach,
  v.new_ads_7d, v.new_ads_30d,
  ROUND(v.new_ads_7d * (b.total_reach / 1e6), 1) AS velocity_reach_score
FROM v
JOIN ad_intel.dim_brand b USING (brand_id)
WHERE v.new_ads_7d > 0
ORDER BY new_ads_7d DESC;

CREATE OR REPLACE VIEW ad_intel.mart_share_of_voice AS
SELECT
  b.category, b.country,
  COUNT(*)                 AS active_ads,
  COUNT(DISTINCT a.brand_id) AS brands,
  SUM(a.reach)             AS total_reach
FROM ad_intel.fact_ad a
JOIN ad_intel.dim_brand b USING (brand_id)
WHERE a.is_active
GROUP BY b.category, b.country
ORDER BY total_reach DESC;

CREATE OR REPLACE VIEW ad_intel.mart_format_mix AS
SELECT
  b.category,
  COUNTIF(a.format = 'video')    AS video,
  COUNTIF(a.format = 'image')    AS image,
  COUNTIF(a.format = 'carousel') AS carousel,
  COUNTIF(a.format = 'dpa')      AS dpa,
  COUNT(*)                       AS total_ads
FROM ad_intel.fact_ad a
JOIN ad_intel.dim_brand b USING (brand_id)
GROUP BY b.category
ORDER BY total_ads DESC;

CREATE OR REPLACE VIEW ad_intel.mart_ingestion_health AS
SELECT
  DATE(ingested_at)        AS day,
  COUNT(*)                 AS ads_added,
  COUNT(DISTINCT brand_id) AS brands
FROM ad_intel.fact_ad
WHERE ingested_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY day
ORDER BY day DESC;

-- ---------------------------------------------------------------------------
-- Delivery velocity, off the AdObservation log (raw_observations).
-- Cumulative reach says nothing about rate; the delta between two observations
-- is the closest public proxy we have for how fast Meta chose to serve an ad.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW ad_intel.fact_ad_observation AS
SELECT
  o.id            AS observation_id,
  o.adId          AS ad_pk,
  o.observedAt    AS observed_at,
  o.reach,
  o.isActive      AS is_active,
  LAG(o.reach)      OVER w AS prev_reach,
  LAG(o.observedAt) OVER w AS prev_observed_at,
  TIMESTAMP_DIFF(o.observedAt, LAG(o.observedAt) OVER w, HOUR) AS hours_since_prev
FROM ad_intel.raw_observations o
WINDOW w AS (PARTITION BY o.adId ORDER BY o.observedAt);

-- Per-ad delivery rate. Guards: needs a prior observation, a positive time gap,
-- and a non-negative delta (Meta occasionally revises reach downward; those
-- rows are dropped rather than modelled as negative delivery).
CREATE OR REPLACE VIEW ad_intel.mart_ad_velocity AS
SELECT
  v.ad_pk,
  a.ad_id,
  a.brand_id,
  b.brand_name,
  b.category,
  a.format,
  a.target_countries,
  MAX(v.observed_at)                                  AS last_observed_at,
  MIN(v.observed_at)                                  AS first_observed_at,
  MAX(v.reach)                                        AS reach_latest,
  SUM(v.reach - v.prev_reach)                         AS reach_added,
  SUM(v.hours_since_prev)                             AS hours_measured,
  SAFE_DIVIDE(SUM(v.reach - v.prev_reach), SUM(v.hours_since_prev) / 24) AS reach_per_day,
  COUNTIF(NOT v.is_active) > 0                        AS has_gone_inactive
FROM ad_intel.fact_ad_observation v
JOIN ad_intel.fact_ad a   ON a.ad_pk = v.ad_pk
JOIN ad_intel.dim_brand b USING (brand_id)
WHERE v.prev_reach IS NOT NULL
  AND v.reach IS NOT NULL
  AND v.hours_since_prev > 0
  AND v.reach >= v.prev_reach
GROUP BY v.ad_pk, a.ad_id, a.brand_id, b.brand_name, b.category, a.format, a.target_countries;

-- H1: how concentrated is delivery inside a brand? Share of measured reach that
-- the brand's single fastest creative absorbs. Needs a few weeks of log first.
CREATE OR REPLACE VIEW ad_intel.mart_delivery_concentration AS
SELECT
  brand_name,
  category,
  COUNT(*)                                          AS ads_measured,
  SUM(reach_added)                                  AS reach_added,
  SAFE_DIVIDE(MAX(reach_added), SUM(reach_added))   AS top_ad_share,
  APPROX_QUANTILES(reach_per_day, 100)[OFFSET(50)]  AS median_reach_per_day
FROM ad_intel.mart_ad_velocity
GROUP BY brand_name, category
HAVING ads_measured >= 5
ORDER BY reach_added DESC;
