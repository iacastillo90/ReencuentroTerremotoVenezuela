import React from 'react';

interface SkeletonProps {
  width?: string;
  height?: string;
  borderRadius?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '20px',
  borderRadius = 'var(--radius-sm)',
  className = '',
  style
}) => (
  <div
    className={`skeleton ${className}`}
    style={{
      width,
      height,
      borderRadius,
      background: 'linear-gradient(90deg, var(--clr-surface) 25%, rgba(255,255,255,0.06) 50%, var(--clr-surface) 75%)',
      backgroundSize: '200% 100%',
      animation: 'skeleton-pulse 1.5s ease-in-out infinite',
      ...style
    }}
    aria-hidden="true"
  />
);

export const FeedCardSkeleton: React.FC = () => (
  <div className="feed-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <Skeleton width="48px" height="48px" borderRadius="50%" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <Skeleton width="60%" height="16px" />
        <Skeleton width="40%" height="12px" />
      </div>
    </div>
    <Skeleton width="100%" height="160px" borderRadius="var(--radius-md)" />
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      <Skeleton width="80%" height="12px" />
      <Skeleton width="50%" height="12px" />
    </div>
  </div>
);

export const FeedSkeletonList: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <>
    {Array.from({ length: count }, (_, i) => (
      <FeedCardSkeleton key={i} />
    ))}
  </>
);
