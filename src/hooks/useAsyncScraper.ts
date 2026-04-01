import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { invokeSupabaseFunction, parseSupabaseFunctionError } from '@/lib/supabase-functions';

export type ScrapeJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export function useAsyncScraper() {
  const [status, setStatus] = useState<ScrapeJobStatus>('pending');
  const [results, setResults] = useState<any[]>([]);
  const { toast } = useToast();

  const startScrape = async (payload: any) => {
    setStatus('processing');
    setResults([]);

    try {
      const { data, error } = await invokeSupabaseFunction<{
        listings?: any[];
        sold_comparables?: any[];
      }>('scrape-marketplace', payload);

      if (error) throw error;

      const nextResults = Array.isArray(data?.sold_comparables)
        ? data.sold_comparables
        : Array.isArray(data?.listings)
          ? data.listings
          : [];

      setResults(nextResults);
      setStatus('completed');
      toast({
        title: 'Analysis Complete',
        description: 'Verified marketplace data retrieved successfully.',
      });
    } catch (error) {
      const message = await parseSupabaseFunctionError(error, 'Marketplace verification failed');
      setStatus('failed');
      toast({ title: 'Analysis Failed', description: message, variant: 'destructive' });
    }
  };

  return { startScrape, status, results, jobId: null };
}
