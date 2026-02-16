# Asset Storage Planning

## Scale Projections
- Current: 52 brands, ~500 GB assets
- Future: 300-400 brands, ~2-3 TB assets

## Cloudflare R2 Pricing (chosen solution)
- Storage: $0.015/GB/month
- 2 TB = $30/month
- 3 TB = $45/month
- **Egress: $0 (free)**

## Asset Breakdown Estimates (per 400 brands)
- ~2 million ads total
- Images/carousels: ~800 GB
- Videos (~30% of ads): ~2.2 TB
- Total: ~3 TB

## Optimizations to Consider
1. R2 Infrequent Access for ads >30 days old ($0.01/GB)
2. WebP/AVIF compression (50-70% size reduction)
3. Skip video downloads initially (80% of storage)
4. Thumbnail-only option for videos

## Comparison (3 TB + 10 TB egress/month)
| Provider | Cost |
|----------|------|
| Cloudflare R2 | $45 |
| AWS S3 | $970 |
| Google Cloud | $1,000+ |

## Implementation Notes
- AdAsset table stores URLs and metadata
- originalUrl = Meta CDN (expires)
- storedUrl = R2 URL after download
- Need to implement download pipeline (Phase 7 of v5.0)
