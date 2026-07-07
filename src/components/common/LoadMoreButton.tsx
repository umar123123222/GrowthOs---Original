import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadMoreButtonProps {
  shown: number;
  total: number;
  onLoadMore: () => void;
  loading?: boolean;
  itemLabel?: string;
  className?: string;
}

/**
 * "Load more" button for card / feed lists.
 * Hides itself when everything is shown.
 */
export function LoadMoreButton({
  shown,
  total,
  onLoadMore,
  loading,
  itemLabel = 'items',
  className,
}: LoadMoreButtonProps) {
  if (shown >= total) {
    if (total === 0) return null;
    return (
      <p className={cn('text-center text-sm text-muted-foreground py-6', className)}>
        Showing all {total.toLocaleString()} {itemLabel}
      </p>
    );
  }

  return (
    <div className={cn('flex flex-col items-center gap-2 pt-6', className)}>
      <Button
        variant="outline"
        onClick={onLoadMore}
        disabled={loading}
        className="min-w-[220px]"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Loading…
          </>
        ) : (
          <>Load more</>
        )}
      </Button>
      <p className="text-xs text-muted-foreground">
        Showing {shown.toLocaleString()} of {total.toLocaleString()} {itemLabel}
      </p>
    </div>
  );
}
