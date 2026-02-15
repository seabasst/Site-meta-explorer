'use client';

import { Info } from 'lucide-react';
import { ReactNode, useState } from 'react';

interface FilterTab {
  key: string;
  label: string;
}

interface DashboardCardProps {
  title: string;
  tooltip?: string;
  filterTabs?: FilterTab[];
  defaultTab?: string;
  onTabChange?: (tab: string) => void;
  children: ReactNode;
  rightContent?: ReactNode;
  className?: string;
}

export function DashboardCard({
  title,
  tooltip,
  filterTabs,
  defaultTab,
  onTabChange,
  children,
  rightContent,
  className = '',
}: DashboardCardProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || filterTabs?.[0]?.key || '');
  const [showTooltip, setShowTooltip] = useState(false);

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    onTabChange?.(key);
  };

  return (
    <div className={`dashboard-card p-6 ${className}`}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">{title}</h3>
          {tooltip && (
            <div className="relative">
              <button
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
              >
                <Info className="w-4 h-4" />
              </button>
              {showTooltip && (
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-3 py-2 bg-[var(--text-primary)] text-white text-xs rounded-lg whitespace-nowrap z-50 shadow-lg">
                  {tooltip}
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[var(--text-primary)] rotate-45" />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {filterTabs && filterTabs.length > 0 && (
            <div className="pill-tabs">
              {filterTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={`pill-tab ${activeTab === tab.key ? 'active' : ''}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
          {rightContent}
        </div>
      </div>

      {children}
    </div>
  );
}
