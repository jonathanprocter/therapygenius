import { useEffect, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * Mobile-specific utility component for iOS optimization
 * Handles touch gestures, form improvements, and mobile UX enhancements
 */

// Mobile form field wrapper with iOS optimizations
interface MobileFormFieldProps {
  children: React.ReactNode;
  label?: string;
  error?: string;
  required?: boolean;
}

export function MobileFormField({ children, label, error, required }: MobileFormFieldProps) {
  const isMobile = useIsMobile();
  
  return (
    <div className={`w-full ${isMobile ? 'mb-6' : 'mb-4'}`}>
      {label && (
        <label className={`block text-sm font-medium text-foreground mb-2 ${
          isMobile ? 'text-base' : ''
        }`}>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}
      <div className={isMobile ? 'relative' : ''}>
        {children}
      </div>
      {error && (
        <p className={`text-destructive mt-2 ${
          isMobile ? 'text-base' : 'text-sm'
        }`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// Mobile-optimized button group
interface MobileButtonGroupProps {
  children: React.ReactNode;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export function MobileButtonGroup({ 
  children, 
  orientation = 'horizontal', 
  className = '' 
}: MobileButtonGroupProps) {
  const isMobile = useIsMobile();
  
  const groupClasses = isMobile 
    ? orientation === 'vertical' 
      ? 'flex flex-col space-y-3 w-full'
      : 'flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 w-full'
    : orientation === 'vertical'
      ? 'flex flex-col space-y-2'
      : 'flex space-x-2';
  
  return (
    <div className={`${groupClasses} ${className}`}>
      {children}
    </div>
  );
}

// iOS-specific pull-to-refresh component
interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
  threshold?: number;
}

export function PullToRefresh({ onRefresh, children, threshold = 60 }: PullToRefreshProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const isRefreshing = useRef(false);
  const startY = useRef(0);
  const currentY = useRef(0);
  
  useEffect(() => {
    if (!isMobile || !containerRef.current) return;
    
    const container = containerRef.current;
    
    const handleTouchStart = (e: TouchEvent) => {
      if (container.scrollTop === 0) {
        startY.current = e.touches[0].clientY;
      }
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      if (container.scrollTop === 0 && !isRefreshing.current) {
        currentY.current = e.touches[0].clientY;
        const pullDistance = Math.max(0, currentY.current - startY.current);
        
        if (pullDistance > threshold) {
          // Add visual feedback here if needed
          container.style.transform = `translateY(${Math.min(pullDistance - threshold, 20)}px)`;
        }
      }
    };
    
    const handleTouchEnd = async () => {
      if (container.scrollTop === 0 && !isRefreshing.current) {
        const pullDistance = currentY.current - startY.current;
        
        if (pullDistance > threshold) {
          isRefreshing.current = true;
          container.style.transform = 'translateY(0)';
          
          try {
            await onRefresh();
          } finally {
            isRefreshing.current = false;
          }
        } else {
          container.style.transform = 'translateY(0)';
        }
      }
    };
    
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isMobile, onRefresh, threshold]);
  
  return (
    <div 
      ref={containerRef}
      className="h-full overflow-y-auto scroll-smooth-ios"
      style={{ transition: 'transform 0.3s ease-out' }}
    >
      {children}
    </div>
  );
}

// Mobile-optimized card component
interface MobileCardProps {
  children: React.ReactNode;
  className?: string;
  clickable?: boolean;
  onClick?: () => void;
}

export function MobileCard({ children, className = '', clickable = false, onClick }: MobileCardProps) {
  const isMobile = useIsMobile();
  
  const cardClasses = `
    ${isMobile ? 'mobile-card' : 'p-6 rounded-lg border bg-card'}
    ${clickable ? 'cursor-pointer transition-transform duration-200 active:scale-95' : ''}
    ${className}
  `;
  
  return (
    <div 
      className={cardClasses.trim()}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      } : undefined}
    >
      {children}
    </div>
  );
}

// iOS haptic feedback utility (using vibration API)
export const hapticFeedback = {
  light: () => {
    if ('vibrate' in navigator && /iPhone|iPad|iPod|iOS/.test(navigator.userAgent)) {
      navigator.vibrate(10);
    }
  },
  medium: () => {
    if ('vibrate' in navigator && /iPhone|iPad|iPod|iOS/.test(navigator.userAgent)) {
      navigator.vibrate(20);
    }
  },
  heavy: () => {
    if ('vibrate' in navigator && /iPhone|iPad|iPod|iOS/.test(navigator.userAgent)) {
      navigator.vibrate([30, 10, 30]);
    }
  },
  success: () => {
    if ('vibrate' in navigator && /iPhone|iPad|iPod|iOS/.test(navigator.userAgent)) {
      navigator.vibrate([15, 5, 15]);
    }
  },
  error: () => {
    if ('vibrate' in navigator && /iPhone|iPad|iPod|iOS/.test(navigator.userAgent)) {
      navigator.vibrate([50, 25, 50, 25, 50]);
    }
  }
};

// Mobile-optimized loading states
interface MobileLoadingProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export function MobileLoading({ size = 'md', text }: MobileLoadingProps) {
  const isMobile = useIsMobile();
  
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: isMobile ? 'w-8 h-8' : 'w-6 h-6',
    lg: isMobile ? 'w-12 h-12' : 'w-8 h-8'
  };
  
  return (
    <div className="flex flex-col items-center justify-center space-y-3">
      <div className={`${sizeClasses[size]} border-2 border-primary border-t-transparent rounded-full animate-spin`} />
      {text && (
        <p className={`text-muted-foreground ${
          isMobile ? 'text-base' : 'text-sm'
        }`}>
          {text}
        </p>
      )}
    </div>
  );
}

// Detect iOS device
export const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

// Detect standalone mode (PWA)
export const isStandalone = () => {
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as any).standalone === true;
};

// Mobile viewport height fix for iOS
export function useMobileViewportFix() {
  useEffect(() => {
    const setViewportHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    
    setViewportHeight();
    window.addEventListener('resize', setViewportHeight);
    window.addEventListener('orientationchange', setViewportHeight);
    
    return () => {
      window.removeEventListener('resize', setViewportHeight);
      window.removeEventListener('orientationchange', setViewportHeight);
    };
  }, []);
}