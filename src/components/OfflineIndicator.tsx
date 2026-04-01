import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  WifiOff,
  Wifi,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  CloudOff,
  Cloud,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { SyncStatus } from '@/hooks/useOfflineSync';

/* ───────────────── TYPES ───────────────── */

interface OfflineIndicatorProps {
  status: SyncStatus;
  onRetrySync: () => void;
  variant?: 'banner' | 'badge' | 'floating';
}

/* ───────────────── BANNER VARIANT ───────────────── */

function OfflineBanner({ status, onRetrySync }: OfflineIndicatorProps) {
  if (status.isOnline && status.pendingCount === 0) return null;

  return (
    <AnimatePresence>
      {!status.isOnline && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="bg-amber-500/20 border-b border-amber-500/30"
        >
          <div className="flex items-center justify-center gap-3 px-4 py-2">
            <WifiOff className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-amber-200">
              You're offline. Changes will sync when connected.
            </span>
            {status.pendingCount > 0 && (
              <Badge variant="outline" className="text-amber-400 border-amber-500/30">
                {status.pendingCount} pending
              </Badge>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ───────────────── BADGE VARIANT ───────────────── */

function SyncBadge({ status, onRetrySync }: OfflineIndicatorProps) {
  const formatLastSync = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-8 gap-2 px-2',
            !status.isOnline && 'text-amber-400',
            status.isSyncing && 'text-primary',
            status.lastError && 'text-red-400'
          )}
        >
          {!status.isOnline ? (
            <CloudOff className="w-4 h-4" />
          ) : status.isSyncing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : status.lastError ? (
            <AlertCircle className="w-4 h-4" />
          ) : (
            <Cloud className="w-4 h-4" />
          )}
          {status.pendingCount > 0 && (
            <span className="text-xs">{status.pendingCount}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">Sync Status</span>
            {status.isOnline ? (
              <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">
                <Wifi className="w-3 h-3 mr-1" />
                Online
              </Badge>
            ) : (
              <Badge variant="outline" className="text-amber-400 border-amber-500/30">
                <WifiOff className="w-3 h-3 mr-1" />
                Offline
              </Badge>
            )}
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Last synced</span>
              <span>{formatLastSync(status.lastSyncTime)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Pending actions</span>
              <span className={status.pendingCount > 0 ? 'text-amber-400' : ''}>
                {status.pendingCount}
              </span>
            </div>
          </div>

          {status.lastError && (
            <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30">
              <p className="text-xs text-red-400">{status.lastError}</p>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={onRetrySync}
            disabled={!status.isOnline || status.isSyncing}
          >
            {status.isSyncing ? (
              <>
                <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="w-3 h-3 mr-2" />
                Sync Now
              </>
            )}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ───────────────── FLOATING VARIANT ───────────────── */

function FloatingIndicator({ status, onRetrySync }: OfflineIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Auto-expand on status change
  useEffect(() => {
    if (!status.isOnline || status.lastError) {
      setIsExpanded(true);
      const timer = setTimeout(() => setIsExpanded(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [status.isOnline, status.lastError]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed bottom-20 right-4 z-50"
      >
        <motion.div
          layout
          className={cn(
            'rounded-full shadow-lg backdrop-blur-sm cursor-pointer',
            !status.isOnline
              ? 'bg-amber-500/20 border border-amber-500/30'
              : status.isSyncing
              ? 'bg-primary/20 border border-primary/30'
              : status.isReady
              ? 'bg-emerald-500/20 border border-emerald-500/30'
              : 'bg-muted border border-border'
          )}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <AnimatePresence mode="wait">
            {isExpanded ? (
              <motion.div
                key="expanded"
                initial={{ width: 44, opacity: 0 }}
                animate={{ width: 'auto', opacity: 1 }}
                exit={{ width: 44, opacity: 0 }}
                className="flex items-center gap-2 px-4 py-2"
              >
                {!status.isOnline ? (
                  <>
                    <WifiOff className="w-4 h-4 text-amber-400" />
                    <span className="text-sm text-amber-200 whitespace-nowrap">
                      Offline Mode
                    </span>
                    {status.pendingCount > 0 && (
                      <Badge variant="outline" className="text-amber-400 border-amber-500/30 text-xs">
                        {status.pendingCount}
                      </Badge>
                    )}
                  </>
                ) : status.isSyncing ? (
                  <>
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    <span className="text-sm text-primary whitespace-nowrap">
                      Syncing...
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm text-emerald-200 whitespace-nowrap">
                      Ready Offline
                    </span>
                  </>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="collapsed"
                className="w-11 h-11 flex items-center justify-center"
              >
                {!status.isOnline ? (
                  <WifiOff className="w-5 h-5 text-amber-400" />
                ) : status.isSyncing ? (
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                ) : status.isReady ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Cloud className="w-5 h-5 text-muted-foreground" />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ───────────────── MAIN EXPORT ───────────────── */

export function OfflineIndicator({ status, onRetrySync, variant = 'floating' }: OfflineIndicatorProps) {
  switch (variant) {
    case 'banner':
      return <OfflineBanner status={status} onRetrySync={onRetrySync} />;
    case 'badge':
      return <SyncBadge status={status} onRetrySync={onRetrySync} />;
    case 'floating':
    default:
      return <FloatingIndicator status={status} onRetrySync={onRetrySync} />;
  }
}

export { OfflineBanner, SyncBadge, FloatingIndicator };
