import { useEffect } from 'react';
import { useToast } from '@/ui';
import { DOWNLOAD_EVENT, type DownloadOutcome } from '../../services/androidDownloads';

/** Tells the user where an export went, or that it did not (Android, #493). */
export function AndroidDownloadNotices() {
  const { toast } = useToast();
  useEffect(() => {
    const show = (event: Event) => {
      const outcome = (event as CustomEvent<DownloadOutcome>).detail;
      if (outcome.saved) toast({ title: 'File saved', description: outcome.name });
      else if (outcome.error) toast({ variant: 'destructive', title: `${outcome.name} was not saved`, description: outcome.error });
    };
    window.addEventListener(DOWNLOAD_EVENT, show);
    return () => window.removeEventListener(DOWNLOAD_EVENT, show);
  }, [toast]);
  return null;
}
