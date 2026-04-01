import { useEffect, useState, useCallback } from 'react';
import { getQueue, dequeueAction } from '@/lib/offlineDB';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  const flushQueue = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;
    const queue = await getQueue();
    if (queue.length === 0) return;

    setIsSyncing(true);
    let successCount = 0;

    try {
      for (const item of queue) {
        if (!item.id) continue;
        if (item.action === 'ADD_INVENTORY') {
          const { error } = await supabase.from('Inventory').insert(item.payload);
          if (!error) { await dequeueAction(item.id); successCount++; }
        }
      }
      if (successCount > 0) toast({ title: "Connection Restored", description: `Synced ${successCount} offline items.` });
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, toast]);

  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); flushQueue(); };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if (navigator.onLine) flushQueue();
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [flushQueue]);

  return { isOnline, isSyncing };
}
