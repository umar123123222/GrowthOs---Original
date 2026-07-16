import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Search, Users, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface BatchOption {
  id: string;
  name: string;
  course_id?: string | null;
  status?: string;
  start_date?: string;
}

interface BatchPickerProps {
  batches: BatchOption[];
  courses?: { id: string; title: string }[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  mode?: 'single' | 'multi';
  placeholder?: string;
  includeAll?: boolean;
  includeUnbatched?: boolean;
  width?: string;
  disabled?: boolean;
}

const ALL_VALUE = '__all__';
const UNBATCHED_VALUE = 'unbatched';

function statusTone(status?: string): string {
  switch (status?.toLowerCase()) {
    case 'active':
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 ring-emerald-500/20';
    case 'draft':
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-300 ring-amber-500/20';
    case 'completed':
      return 'bg-slate-500/10 text-slate-600 dark:text-slate-300 ring-slate-500/20';
    default:
      return 'bg-muted text-muted-foreground ring-border';
  }
}

export function BatchPicker({
  batches,
  courses = [],
  value,
  onChange,
  mode = 'single',
  placeholder = 'Select batch',
  includeAll = true,
  includeUnbatched = false,
  width = 'w-[220px]',
  disabled = false,
}: BatchPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedIds: string[] = mode === 'multi'
    ? Array.isArray(value) ? value : value ? [value] : [ALL_VALUE]
    : value ? [value as string] : [];

  const isAllSelected = selectedIds.includes(ALL_VALUE);
  const isUnbatchedSelected = selectedIds.includes(UNBATCHED_VALUE);
  const realSelectedIds = selectedIds.filter(id => id !== ALL_VALUE && id !== UNBATCHED_VALUE);

  const sortedBatches = useMemo(() => {
    return [...batches].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }, [batches]);

  const filteredBatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedBatches;
    return sortedBatches.filter(b => {
      const courseName = courses.find(c => c.id === b.course_id)?.title || '';
      return (
        b.name.toLowerCase().includes(q) ||
        (b.status?.toLowerCase() ?? '').includes(q) ||
        courseName.toLowerCase().includes(q)
      );
    });
  }, [sortedBatches, courses, query]);

  const courseMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of courses) map[c.id] = c.title;
    return map;
  }, [courses]);

  const triggerLabel = useMemo(() => {
    if (mode === 'single') {
      if (value === ALL_VALUE) return 'All Batches';
      if (value === UNBATCHED_VALUE) return 'Unbatched students';
      const batch = batches.find(b => b.id === value);
      return batch?.name || placeholder;
    }

    if (isAllSelected) return 'All Batches';
    const parts: string[] = [];
    if (isUnbatchedSelected) parts.push('Unbatched');
    if (realSelectedIds.length > 0) {
      if (realSelectedIds.length === 1) {
        const name = batches.find(b => b.id === realSelectedIds[0])?.name || realSelectedIds[0];
        parts.push(name);
      } else {
        parts.push(`${realSelectedIds.length} batch${realSelectedIds.length > 1 ? 'es' : ''}`);
      }
    }
    return parts.length > 0 ? parts.join(' + ') : placeholder;
  }, [mode, value, isAllSelected, isUnbatchedSelected, realSelectedIds, batches, placeholder]);

  const handleSingleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery('');
  };

  const handleMultiToggle = (id: string, checked: boolean) => {
    if (id === ALL_VALUE) {
      onChange(checked ? [ALL_VALUE] : []);
      return;
    }

    let next = selectedIds.filter(v => v !== ALL_VALUE);

    if (id === UNBATCHED_VALUE) {
      if (checked) {
        next = next.includes(UNBATCHED_VALUE) ? next : [...next, UNBATCHED_VALUE];
      } else {
        next = next.filter(v => v !== UNBATCHED_VALUE);
      }
      onChange(next.length ? next : [ALL_VALUE]);
      return;
    }

    if (checked) {
      next = next.includes(id) ? next : [...next, id];
    } else {
      next = next.filter(v => v !== id);
    }

    onChange(next.length ? next : [ALL_VALUE]);
  };

  const renderRow = (id: string, label: React.ReactNode, checked: boolean, onToggle: (checked: boolean) => void, meta?: React.ReactNode) => {
    if (mode === 'single') {
      const isSelected = selectedIds[0] === id;
      return (
        <button
          type="button"
          key={id}
          onClick={() => handleSingleSelect(id)}
          className={cn(
            'w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/60 transition-colors',
            isSelected && 'bg-primary/5'
          )}
        >
          <span className="flex items-center gap-2 min-w-0">
            <Users className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="flex-1 min-w-0">
              <span className="text-sm font-medium truncate block">{label}</span>
              {meta && <span className="block text-xs text-muted-foreground truncate">{meta}</span>}
            </span>
          </span>
          {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
        </button>
      );
    }

    return (
      <label
        key={id}
        className="flex items-center gap-2.5 px-3 py-2 rounded hover:bg-muted/60 cursor-pointer text-sm"
      >
        <Checkbox
          checked={checked}
          onCheckedChange={onToggle}
        />
        <span className="flex-1 min-w-0">
          <span className="font-medium truncate block">{label}</span>
          {meta && <span className="block text-xs text-muted-foreground truncate">{meta}</span>}
        </span>
      </label>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('justify-between font-normal h-9 text-sm bg-background', width)}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[260px] bg-background border shadow-lg z-50" align="start">
        <div className="p-2 border-b bg-muted/30">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search batches…"
              className="w-full pl-8 pr-8 h-9 rounded-md bg-background border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto py-1">
          {filteredBatches.length === 0 && !includeAll && !includeUnbatched ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              <Users className="h-6 w-6 mx-auto mb-2 opacity-40" />
              No batches match "{query}"
            </div>
          ) : (
            <div className="space-y-0.5">
              {includeAll && renderRow(
                ALL_VALUE,
                'All Batches',
                isAllSelected,
                (checked) => mode === 'multi' && handleMultiToggle(ALL_VALUE, checked as boolean)
              )}
              {includeUnbatched && renderRow(
                UNBATCHED_VALUE,
                'Unbatched students',
                isUnbatchedSelected,
                (checked) => mode === 'multi' && handleMultiToggle(UNBATCHED_VALUE, checked as boolean)
              )}
              {(includeAll || includeUnbatched) && filteredBatches.length > 0 && <div className="border-t my-1" />}
              {filteredBatches.map((batch) => {
                const checked = selectedIds.includes(batch.id);
                const meta = (
                  <span className="flex items-center gap-2">
                    {batch.status && (
                      <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-4 rounded-full', statusTone(batch.status))}>
                        {batch.status}
                      </Badge>
                    )}
                    {batch.course_id && courseMap[batch.course_id] && (
                      <span className="text-xs text-muted-foreground truncate">{courseMap[batch.course_id]}</span>
                    )}
                  </span>
                );
                return renderRow(
                  batch.id,
                  batch.name,
                  checked,
                  (c) => mode === 'multi' && handleMultiToggle(batch.id, c as boolean),
                  meta
                );
              })}
            </div>
          )}
        </div>

        <div className="px-3 py-2 border-t bg-muted/30 text-[11px] text-muted-foreground flex items-center justify-between">
          <span>{filteredBatches.length} of {batches.length} batches</span>
          <span className="opacity-70">Type to search</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
