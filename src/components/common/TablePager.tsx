import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { cn } from '@/lib/utils';

interface TablePagerProps {
  page: number;
  pageCount: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
  itemLabel?: string; // e.g. "students", "invoices"
}

/**
 * Numbered pagination widget for admin tables.
 * Renders: "Showing 51–100 of 2,109" + « 1 2 … 42 »
 */
export function TablePager({
  page,
  pageCount,
  totalItems,
  pageSize,
  onPageChange,
  className,
  itemLabel = 'items',
}: TablePagerProps) {
  if (pageCount <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  const pages = buildPageList(page, pageCount);

  const go = (p: number) => {
    if (p < 1 || p > pageCount || p === page) return;
    onPageChange(p);
    // Scroll the page top into view so the new rows are visible.
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-4', className)}>
      <p className="text-sm text-muted-foreground">
        Showing <span className="font-medium text-foreground">{start.toLocaleString()}</span>–
        <span className="font-medium text-foreground">{end.toLocaleString()}</span> of{' '}
        <span className="font-medium text-foreground">{totalItems.toLocaleString()}</span> {itemLabel}
      </p>
      <Pagination className="mx-0 sm:justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={(e) => { e.preventDefault(); go(page - 1); }}
              className={cn('cursor-pointer', page <= 1 && 'pointer-events-none opacity-50')}
              href="#"
            />
          </PaginationItem>
          {pages.map((p, i) =>
            p === 'ellipsis' ? (
              <PaginationItem key={`e-${i}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={p}>
                <PaginationLink
                  href="#"
                  isActive={p === page}
                  onClick={(e) => { e.preventDefault(); go(p); }}
                  className="cursor-pointer"
                >
                  {p}
                </PaginationLink>
              </PaginationItem>
            ),
          )}
          <PaginationItem>
            <PaginationNext
              onClick={(e) => { e.preventDefault(); go(page + 1); }}
              className={cn('cursor-pointer', page >= pageCount && 'pointer-events-none opacity-50')}
              href="#"
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}

/**
 * Build a compact page list: [1, 'ellipsis', 4, 5, 6, 'ellipsis', 42]
 */
function buildPageList(current: number, total: number): (number | 'ellipsis')[] {
  const delta = 1; // pages either side of current
  const range: (number | 'ellipsis')[] = [];
  const lastPage = total;

  const add = (n: number) => {
    if (n >= 1 && n <= lastPage && !range.includes(n)) range.push(n);
  };

  add(1);
  const start = Math.max(2, current - delta);
  const end = Math.min(lastPage - 1, current + delta);

  if (start > 2) range.push('ellipsis');
  for (let i = start; i <= end; i++) add(i);
  if (end < lastPage - 1) range.push('ellipsis');
  if (lastPage > 1) add(lastPage);

  return range;
}
