import { useState } from 'react';

export const useNotificationPreferences = () => {
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);

  const openPreferences = () => setIsPreferencesOpen(true);
  const closePreferences = () => setIsPreferencesOpen(false);

  return {
    isPreferencesOpen,
    openPreferences,
    closePreferences,
  };
};