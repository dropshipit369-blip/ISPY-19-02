import React from 'react';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { OfflineIndicator } from '@/components/OfflineIndicator';

export const OfflineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isOnline, isSyncing } = useOfflineSync();
  return (
    <>
      {!isOnline && <OfflineIndicator />}
      {isSyncing && <div className="fixed top-0 left-0 w-full h-1 bg-primary animate-pulse z-50" />}
      {children}
    </>
  );
};
