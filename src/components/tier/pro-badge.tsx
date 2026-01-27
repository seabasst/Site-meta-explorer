'use client';

interface ProBadgeProps {
  className?: string;
  size?: 'sm' | 'md';
}

export function ProBadge({ className = '', size = 'sm' }: ProBadgeProps) {
  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-0.5',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium ${sizeClasses[size]} ${className}`}
    >
      Pro
    </span>
  );
}
