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
