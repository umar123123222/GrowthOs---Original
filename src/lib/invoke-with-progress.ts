import { supabase } from '@/integrations/supabase/client';
import { progressBar } from '@/lib/progress-bar';

type InvokeArgs = Parameters<typeof supabase.functions.invoke>;

/**
 * Drop-in replacement for `supabase.functions.invoke` that also drives the
 * global top progress bar while the request is in-flight.
 */
export async function invokeWithProgress<T = any>(
  functionName: InvokeArgs[0],
  options?: InvokeArgs[1],
) {
  progressBar.start();
  try {
    return (await supabase.functions.invoke(functionName, options)) as {
      data: T | null;
      error: any;
    };
  } finally {
    progressBar.done();
  }
}
