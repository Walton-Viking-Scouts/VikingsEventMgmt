import React from 'react';
import { Notification } from '../../contexts/notifications/types';
import Banner from './Banner';

interface BannerContainerProps {
  banners: Notification[];
  onDismiss: (id: string) => void;
  position?: 'top' | 'bottom';
  className?: string;
}

const BannerContainer: React.FC<BannerContainerProps> = ({ 
  banners, 
  onDismiss, 
  position = 'top',
  className = ''
}) => {
  if (banners.length === 0) {
    return null;
  }

  return (
    <div 
      className={`w-full z-40 ${position === 'top' ? 'mb-4' : 'mt-4'} ${className}`}
      aria-live="polite"
      aria-label="System notifications"
    >
      <div className="space-y-2">
        {banners.map((banner) => (
          <Banner
            key={banner.id}
            notification={banner}
            onDismiss={() => onDismiss(banner.id)}
          />
        ))}
      </div>
    </div>
  );
};

export default BannerContainer;