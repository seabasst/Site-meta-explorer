'use client';

import { formatCurrency, formatNumber, type SpendAnalysis, type ProductSpend, type CountrySpend } from '@/lib/spend-estimator';

interface SpendAnalysisProps {
  analysis: SpendAnalysis;
}

export function SpendSummary({ analysis }: SpendAnalysisProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
        <div className="text-2xl font-bold text-[var(--accent-yellow)]">
          {formatCurrency(analysis.totalEstimatedSpend)}
        </div>
        <div className="text-xs text-[var(--text-muted)] mt-1">Est. Total Spend</div>
      </div>
      <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
        <div className="text-2xl font-bold text-[var(--text-primary)]">
          {formatNumber(analysis.totalReach)}
        </div>
        <div className="text-xs text-[var(--text-muted)] mt-1">Total Reach</div>
      </div>
      <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
        <div className="text-2xl font-bold text-[var(--text-primary)]">
          {formatCurrency(analysis.averageCPM)}
        </div>
        <div className="text-xs text-[var(--text-muted)] mt-1">Avg CPM</div>
      </div>
      <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
        <div className="text-2xl font-bold text-[var(--text-primary)]">
          {analysis.spendByCountry.length}
        </div>
        <div className="text-xs text-[var(--text-muted)] mt-1">Markets</div>
      </div>
    </div>
  );
}

export function SpendByCountryChart({ countries }: { countries: CountrySpend[] }) {
  const maxSpend = Math.max(...countries.map(c => c.estimatedSpend));

  return (
    <div className="space-y-3">
      {countries.slice(0, 10).map((country) => (
        <div key={country.countryCode} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-primary)] font-medium">
              {country.countryName}
            </span>
            <span className="text-[var(--text-secondary)]">
              {formatCurrency(country.estimatedSpend)}
              <span className="text-[var(--text-muted)] ml-2">
                ({formatNumber(country.reach)} reach)
              </span>
            </span>
          </div>
          <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--accent-yellow)] rounded-full transition-all duration-500"
              style={{ width: `${(country.estimatedSpend / maxSpend) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TopProductsTable({ products }: { products: ProductSpend[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border-subtle)]">
            <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
              #
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
              Product / Ad
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
              Est. Spend
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
              Reach
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
              Top Markets
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
              View
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle)]">
          {products.slice(0, 5).map((product, index) => (
            <tr key={product.adId} className="hover:bg-[var(--bg-elevated)] transition-colors">
              <td className="px-4 py-4">
                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                  index === 0 ? 'bg-[var(--accent-yellow)] text-[#1c1c0d]' :
                  index === 1 ? 'bg-gray-300 text-gray-700' :
                  index === 2 ? 'bg-amber-600 text-white' :
                  'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                }`}>
                  {index + 1}
                </span>
              </td>
              <td className="px-4 py-4">
                <div className="max-w-[300px]">
                  <div className="font-medium text-[var(--text-primary)] truncate">
                    {product.title}
                  </div>
                  {product.description && (
                    <div className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                      {product.description.slice(0, 80)}...
                    </div>
                  )}
                  <div className="text-xs text-[var(--text-muted)] mt-1">
                    {product.isActive ? (
                      <span className="text-green-500">Active</span>
                    ) : (
                      <span className="text-gray-400">Inactive</span>
                    )}
                    {product.startedRunning && (
                      <span className="ml-2">Started: {product.startedRunning}</span>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-4 py-4 text-right">
                <span className="font-bold text-[var(--accent-yellow)]">
                  {formatCurrency(product.totalEstimatedSpend)}
                </span>
              </td>
              <td className="px-4 py-4 text-right text-[var(--text-secondary)]">
                {formatNumber(product.totalReach)}
              </td>
              <td className="px-4 py-4">
                <div className="flex justify-center gap-1 flex-wrap">
                  {product.spendByCountry.slice(0, 3).map((country) => (
                    <span
                      key={country.countryCode}
                      className="px-2 py-0.5 text-xs rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"
                      title={`${country.countryName}: ${formatCurrency(country.estimatedSpend)}`}
                    >
                      {country.countryCode}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-4 py-4 text-right">
                <a
                  href={`https://www.facebook.com/ads/library/?id=${product.adArchiveId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-[var(--bg-elevated)] text-[var(--accent-green-light)] hover:bg-[var(--border-subtle)] transition-colors"
                >
                  View Ad
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SpendAnalysisSection({ analysis }: SpendAnalysisProps) {
  if (!analysis || analysis.totalEstimatedSpend === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <SpendSummary analysis={analysis} />

      {/* Two Column Layout for Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spend by Country */}
        <div className="glass rounded-xl p-5">
          <h4 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wide mb-4">
            Estimated Spend by Market
          </h4>
          <SpendByCountryChart countries={analysis.spendByCountry} />
        </div>

        {/* Top Products */}
        <div className="glass rounded-xl p-5">
          <h4 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wide mb-4">
            Top 5 Products by Ad Spend
          </h4>
          {analysis.topProducts.length > 0 ? (
            <TopProductsTable products={analysis.topProducts} />
          ) : (
            <p className="text-sm text-[var(--text-muted)]">No product data available</p>
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="flex gap-2 text-xs text-[var(--text-muted)]">
        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>
          Spend estimates are based on industry CPM benchmarks and actual reach data.
          Actual spend may vary based on targeting, bidding strategy, and ad quality.
        </span>
      </div>
    </div>
  );
}
