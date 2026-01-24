'use client';

import { useState } from 'react';
import type { ProductMarketMatrix, ProductAnalysis } from '@/lib/facebook-api';

interface ProductMarketTableProps {
  data: ProductMarketMatrix;
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toLocaleString();
}

// Mini sparkline bar
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const width = Math.max((value / max) * 100, 2);
  return (
    <div className="w-16 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${width}%`,
          background: color
        }}
      />
    </div>
  );
}

function ProductRow({ product, rank, maxReach }: { product: ProductAnalysis; rank: number; maxReach: number }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const rankColors = {
    1: 'bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-900',
    2: 'bg-gradient-to-r from-slate-300 to-slate-200 text-slate-700',
    3: 'bg-gradient-to-r from-amber-600 to-amber-500 text-amber-100'
  };

  return (
    <>
      <tr
        className="group hover:bg-[var(--bg-elevated)]/50 transition-all cursor-pointer border-b border-[var(--border-subtle)]/50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Rank */}
        <td className="px-4 py-4">
          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold shadow-sm ${
            rankColors[rank as keyof typeof rankColors] || 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
          }`}>
            {rank}
          </span>
        </td>

        {/* Product */}
        <td className="px-4 py-4">
          <div className="max-w-[350px]">
            <div className="flex items-center gap-2">
              <button
                className={`flex-shrink-0 w-5 h-5 rounded flex items-center justify-center bg-[var(--bg-tertiary)] group-hover:bg-[var(--bg-elevated)] transition-all ${
                  isExpanded ? 'rotate-90' : ''
                }`}
              >
                <svg className="w-3 h-3 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <span className="font-semibold text-[var(--text-primary)] truncate">
                {product.productName}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1.5 ml-7">
              {product.isActive ? (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                  Inactive
                </span>
              )}
              <span className="text-xs text-[var(--text-muted)]">
                {product.adCount} ad{product.adCount !== 1 ? 's' : ''}
              </span>
              {product.startedRunning && (
                <span className="text-xs text-[var(--text-muted)]">
                  Since {product.startedRunning}
                </span>
              )}
            </div>
          </div>
        </td>

        {/* Reach with mini bar */}
        <td className="px-4 py-4">
          <div className="flex flex-col items-end gap-1">
            <span className="text-lg font-bold tabular-nums text-[var(--accent-yellow)]">
              {formatNumber(product.totalReach)}
            </span>
            <MiniBar value={product.totalReach} max={maxReach} color="linear-gradient(to right, #f59e0b, #fbbf24)" />
          </div>
        </td>

        {/* Markets */}
        <td className="px-4 py-4">
          <div className="flex gap-1.5 flex-wrap justify-center">
            {product.markets.slice(0, 4).map((market, i) => (
              <span
                key={market.countryCode}
                className={`px-2 py-1 text-xs rounded-md font-medium transition-all ${
                  i === 0
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-transparent'
                }`}
                title={`${market.countryName}: ${formatNumber(market.reach)} reach`}
              >
                {market.countryCode}
              </span>
            ))}
            {product.markets.length > 4 && (
              <span className="px-2 py-1 text-xs text-[var(--text-muted)] font-medium">
                +{product.markets.length - 4}
              </span>
            )}
          </div>
        </td>

        {/* Action */}
        <td className="px-4 py-4 text-right">
          <a
            href={`https://www.facebook.com/ads/library/?id=${product.adIds[0]}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--accent-green-light)]/10 hover:text-[var(--accent-green-light)] transition-all border border-transparent hover:border-[var(--accent-green-light)]/30"
            onClick={(e) => e.stopPropagation()}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            View
          </a>
        </td>
      </tr>

      {/* Expanded market details */}
      {isExpanded && (
        <tr className="bg-gradient-to-b from-[var(--bg-tertiary)]/80 to-transparent">
          <td colSpan={5} className="px-4 py-6">
            <div className="ml-11 space-y-5">
              {/* Market breakdown header */}
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 rounded-full bg-gradient-to-b from-emerald-400 to-teal-500" />
                <h5 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  Reach by Market
                </h5>
              </div>

              {/* Market cards grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {product.markets.map((market, i) => {
                  const isTop = i === 0;
                  return (
                    <div
                      key={market.countryCode}
                      className={`relative p-4 rounded-xl border transition-all hover:scale-[1.02] ${
                        isTop
                          ? 'bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border-emerald-500/30'
                          : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] hover:border-[var(--border-default)]'
                      }`}
                    >
                      {isTop && (
                        <div className="absolute -top-2 -right-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-emerald-500 text-white rounded-md shadow-lg">
                          Top
                        </div>
                      )}
                      <div className="flex items-center justify-between mb-3">
                        <span className={`font-semibold ${isTop ? 'text-emerald-400' : 'text-[var(--text-primary)]'}`}>
                          {market.countryName}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)] font-mono">
                          {market.countryCode}
                        </span>
                      </div>
                      <div className={`text-2xl font-black tabular-nums ${isTop ? 'text-emerald-400' : 'text-[var(--text-primary)]'}`}>
                        {formatNumber(market.reach)}
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-[var(--text-muted)]">
                          {market.percentage.toFixed(1)}% of total
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-3 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            isTop ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-[var(--text-muted)]/30'
                          }`}
                          style={{ width: `${Math.min(market.percentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Ad variations */}
              {product.adIds.length > 1 && (
                <div className="pt-4 border-t border-[var(--border-subtle)]">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-1 h-4 rounded-full bg-gradient-to-b from-blue-400 to-indigo-500" />
                    <h5 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                      Ad Variations ({product.adIds.length})
                    </h5>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {product.adIds.slice(0, 10).map((adId, idx) => (
                      <a
                        key={adId}
                        href={`https://www.facebook.com/ads/library/?id=${adId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-blue-400 hover:bg-blue-500/10 transition-all border border-[var(--border-subtle)] hover:border-blue-500/30"
                      >
                        <span className="w-4 h-4 rounded bg-[var(--bg-tertiary)] flex items-center justify-center text-[10px] font-bold">
                          {idx + 1}
                        </span>
                        Variation
                      </a>
                    ))}
                    {product.adIds.length > 10 && (
                      <span className="px-3 py-1.5 text-xs text-[var(--text-muted)]">
                        +{product.adIds.length - 10} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function ProductMarketTable({ data }: ProductMarketTableProps) {
  if (!data || data.products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-16 h-16 mb-4 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center">
          <svg className="w-8 h-8 text-[var(--text-muted)] opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <p className="text-[var(--text-muted)]">No product data available</p>
      </div>
    );
  }

  const maxReach = Math.max(...data.products.map(p => p.totalReach), 1);

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="relative p-5 rounded-2xl bg-gradient-to-br from-[var(--bg-tertiary)] to-[var(--bg-elevated)] border border-[var(--border-subtle)] overflow-hidden group hover:border-[var(--accent-yellow)]/30 transition-all">
          <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-[var(--accent-yellow)]/5 group-hover:bg-[var(--accent-yellow)]/10 transition-colors" />
          <div className="relative">
            <div className="text-3xl font-black text-[var(--accent-yellow)] tabular-nums">
              {data.products.length}
            </div>
            <div className="text-xs font-medium text-[var(--text-muted)] mt-1 uppercase tracking-wider">
              Products Identified
            </div>
          </div>
        </div>

        <div className="relative p-5 rounded-2xl bg-gradient-to-br from-[var(--bg-tertiary)] to-[var(--bg-elevated)] border border-[var(--border-subtle)] overflow-hidden group hover:border-blue-500/30 transition-all">
          <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-blue-500/5 group-hover:bg-blue-500/10 transition-colors" />
          <div className="relative">
            <div className="text-3xl font-black text-blue-400 tabular-nums">
              {formatNumber(data.totalReach)}
            </div>
            <div className="text-xs font-medium text-[var(--text-muted)] mt-1 uppercase tracking-wider">
              Total Reach
            </div>
          </div>
        </div>

        <div className="relative p-5 rounded-2xl bg-gradient-to-br from-[var(--bg-tertiary)] to-[var(--bg-elevated)] border border-[var(--border-subtle)] overflow-hidden group hover:border-emerald-500/30 transition-all">
          <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-emerald-500/5 group-hover:bg-emerald-500/10 transition-colors" />
          <div className="relative">
            <div className="text-3xl font-black text-emerald-400 tabular-nums">
              {data.allMarkets.length}
            </div>
            <div className="text-xs font-medium text-[var(--text-muted)] mt-1 uppercase tracking-wider">
              Markets Targeted
            </div>
          </div>
        </div>
      </div>

      {/* Products table */}
      <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/30">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/50">
              <th className="px-4 py-4 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider w-14">
                #
              </th>
              <th className="px-4 py-4 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Product / Ad
              </th>
              <th className="px-4 py-4 text-right text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider w-28">
                Reach
              </th>
              <th className="px-4 py-4 text-center text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider w-44">
                Top Markets
              </th>
              <th className="px-4 py-4 text-right text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider w-24">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {data.products.map((product, index) => (
              <ProductRow
                key={product.productId}
                product={product}
                rank={index + 1}
                maxReach={maxReach}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Tip */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-tertiary)]/30 border border-[var(--border-subtle)]">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
          <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <span className="text-xs text-[var(--text-muted)]">
          Click on a product row to see detailed market breakdown and ad variations.
        </span>
      </div>
    </div>
  );
}
