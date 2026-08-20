import { useState, useEffect, useRef } from 'react';

interface UsePullToRefreshProps {
  onRefresh: () => Promise<void>;
  disabled?: boolean;
}

export const usePullToRefresh = ({ onRefresh, disabled = false }: UsePullToRefreshProps) => {
  const [pullOffset, setPullOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const isPulling = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current || document.documentElement;

    const handleTouchStart = (e: TouchEvent) => {
      if (disabled || refreshing) return;
      
      // Only trigger if scroll position is at the very top
      const scrollTop = container === document.documentElement ? window.scrollY : container.scrollTop;
      if (scrollTop === 0) {
        startY.current = e.touches[0].clientY;
        isPulling.current = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling.current || disabled || refreshing) return;

      const currentY = e.touches[0].clientY;
      const diffY = currentY - startY.current;

      if (diffY > 0) {
        // Apply resistance factor to pull distance
        const offset = Math.min(100, Math.pow(diffY, 0.8));
        setPullOffset(offset);
        
        // Prevent default browser refresh pull-down behavior
        if (e.cancelable) {
          e.preventDefault();
        }
      } else {
        isPulling.current = false;
        setPullOffset(0);
      }
    };

    const handleTouchEnd = async () => {
      if (!isPulling.current) return;
      isPulling.current = false;

      // Trigger refresh if pulled beyond 60px threshold
      if (pullOffset > 60) {
        setRefreshing(true);
        setPullOffset(60); // Keep indicator visible during refresh
        try {
          await onRefresh();
        } catch (err) {
          console.error('[PullToRefresh] Refresh failed:', err);
        } finally {
          setTimeout(() => {
            setRefreshing(false);
            setPullOffset(0);
          }, 800); // Minimum spinning time for user feedback
        }
      } else {
        setPullOffset(0);
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onRefresh, pullOffset, refreshing, disabled]);

  return {
    pullOffset,
    refreshing,
    containerRef
  };
};
