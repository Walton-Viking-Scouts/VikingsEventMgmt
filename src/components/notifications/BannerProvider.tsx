import React, { createContext, useContext, useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Notification } from '../../contexts/notifications/types';
import BannerContainer from './BannerContainer';

interface BannerContextType {
  banners: Notification[];
  addBanner: (banner: Omit<Notification, 'id' | 'timestamp'>) => string;
  updateBanner: (id: string, banner: Partial<Notification>) => void;
  removeBanner: (id: string) => void;
  removeAllBanners: () => void;
  // Shorthand methods for banners (typically more persistent)
  bannerSuccess: (message: string, options?: Partial<Omit<Notification, 'id' | 'type' | 'message' | 'timestamp'>>) => string;
  bannerError: (message: string, options?: Partial<Omit<Notification, 'id' | 'type' | 'message' | 'timestamp'>>) => string;
  bannerWarning: (message: string, options?: Partial<Omit<Notification, 'id' | 'type' | 'message' | 'timestamp'>>) => string;
  bannerInfo: (message: string, options?: Partial<Omit<Notification, 'id' | 'type' | 'message' | 'timestamp'>>) => string;
}

const BannerContext = createContext<BannerContextType | undefined>(undefined);

interface BannerProviderProps {
  children: React.ReactNode;
  position?: 'top' | 'bottom';
  maxBanners?: number;
}

export const BannerProvider: React.FC<BannerProviderProps> = ({ 
  children, 
  position = 'top',
  maxBanners = 3
}) => {
  const [banners, setBanners] = useState<Notification[]>([]);

  const addBanner = useCallback((banner: Omit<Notification, 'id' | 'timestamp'>) => {
    const id = uuidv4();
    const newBanner = {
      ...banner,
      id,
      timestamp: Date.now()
    };
    
    setBanners(prev => {
      const updated = [...prev, newBanner];
      // Limit the number of banners to prevent UI overload
      return updated.slice(-maxBanners);
    });
    return id;
  }, [maxBanners]);

  const updateBanner = useCallback((id: string, banner: Partial<Notification>) => {
    setBanners(prev =>
      prev.map(b => b.id === id ? { ...b, ...banner } : b)
    );
  }, []);

  const removeBanner = useCallback((id: string) => {
    setBanners(prev => prev.filter(b => b.id !== id));
  }, []);

  const removeAllBanners = useCallback(() => {
    setBanners([]);
  }, []);

  // Shorthand methods with banner-appropriate defaults (more persistent than toasts)
  const bannerSuccess = useCallback((message: string, options = {}) => {
    return addBanner({
      type: 'success',
      message,
      persistent: false,
      duration: 8000, // Longer duration for banners
      ...options
    });
  }, [addBanner]);

  const bannerError = useCallback((message: string, options = {}) => {
    return addBanner({
      type: 'error',
      message,
      persistent: true, // Error banners are persistent by default
      ...options
    });
  }, [addBanner]);

  const bannerWarning = useCallback((message: string, options = {}) => {
    return addBanner({
      type: 'warning',
      message,
      persistent: false,
      duration: 10000, // Longer for warnings
      ...options
    });
  }, [addBanner]);

  const bannerInfo = useCallback((message: string, options = {}) => {
    return addBanner({
      type: 'info',
      message,
      persistent: false,
      duration: 8000,
      ...options
    });
  }, [addBanner]);

  const value = {
    banners,
    addBanner,
    updateBanner,
    removeBanner,
    removeAllBanners,
    bannerSuccess,
    bannerError,
    bannerWarning,
    bannerInfo
  };

  return (
    <BannerContext.Provider value={value}>
      <BannerContainer banners={banners} onDismiss={removeBanner} position={position} />
      {children}
    </BannerContext.Provider>
  );
};

export const useBanner = () => {
  const context = useContext(BannerContext);
  if (context === undefined) {
    throw new Error('useBanner must be used within a BannerProvider');
  }
  return context;
};