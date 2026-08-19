#!/usr/bin/env bash
# =============================================================================
# P0 — BigQuery warehouse foundation for the ad corpus.
#
# Creates a dataset + a scoped service account in the existing GCP project.
# Run ONCE, interactively, after `gcloud auth login` (needs your user creds).
# Idempotent-ish: re-running create commands on existing resources just errors
# harmlessly. Review the vars, then: bash scripts/bq-setup.sh
# =============================================================================
set -euo pipefail

PROJECT="${GCP_PROJECT:-kiri-media-reporting}"
LOCATION="${BQ_LOCATION:-EU}"          # EU multi-region — matches Neon/Fly footprint
DATASET="${BQ_DATASET:-ad_intel}"
SA_NAME="${BQ_SA_NAME:-ad-intel-sync}"
SA_EMAIL="${SA_NAME}@${PROJECT}.iam.gserviceaccount.com"
KEY_OUT="${BQ_KEY_OUT:-./ad-intel-sync-key.json}"

echo "Project=$PROJECT  Location=$LOCATION  Dataset=$DATASET  SA=$SA_EMAIL"

# 1) Dataset
bq --project_id="$PROJECT" --location="$LOCATION" mk --dataset \
  --description "Ad Library analytics warehouse (raw + modelled)" \
  "${PROJECT}:${DATASET}" || echo "dataset may already exist, continuing"

# 2) Service account (write-scoped to BigQuery only)
gcloud iam service-accounts create "$SA_NAME" \
  --project="$PROJECT" \
  --display-name="Ad-intel warehouse sync" || echo "SA may already exist, continuing"

# 3) Grant BigQuery data + job roles at project level (dataset-level ACL below tightens data access)
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/bigquery.jobUser" --condition=None

# Dataset-scoped data editor (least privilege — SA can only touch this dataset's data)
bq --project_id="$PROJECT" update \
  --dataset \
  --source <(bq --project_id="$PROJECT" show --format=prettyjson "${PROJECT}:${DATASET}" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); d.setdefault('access',[]).append({'role':'WRITER','userByEmail':'${SA_EMAIL}'}); print(json.dumps(d))") \
  "${PROJECT}:${DATASET}"

# 4) Key for the sync job (store as a Fly secret; never commit)
gcloud iam service-accounts keys create "$KEY_OUT" \
  --iam-account="$SA_EMAIL"

echo
echo "Done. Next:"
echo "  fly secrets set --app greatearth-ingest-worker \\"
echo "    GOOGLE_APPLICATION_CREDENTIALS_JSON=\"\$(cat $KEY_OUT)\" \\"
echo "    BQ_PROJECT=$PROJECT BQ_DATASET=$DATASET BQ_LOCATION=$LOCATION"
echo "  Then delete the local key file: rm $KEY_OUT"
