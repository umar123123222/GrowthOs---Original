import React, { useEffect, useMemo, useState } from 'react';
import { Eye, Loader2, Search, Users2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { safeLogger } from '@/lib/safe-logger';

interface PreviewStudent {
  student_id: string;
  full_name: string;
  email: string;
  lms_status: string | null;
  batch_id: string | null;
  batch_name: string;
  enrolled_at: string | null;
}

interface PreviewGroup {
  key: string;
  label: string;
  count: number;
}

interface Props {
  /** Course ID selected in the form, or '__all__' for no course filter. */
  courseId: string;
  /** Selected batch ids from the form. May contain '__all__' and 'unbatched'. */
  batchIds: string[];
  /** ISO string of session start time, or null if not yet valid. */
  startTime: string | null;
}

export function SessionVisibilityPreview({ courseId, batchIds, startTime }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [groups, setGroups] = useState<PreviewGroup[]>([]);
  const [students, setStudents] = useState<PreviewStudent[]>([]);
  const [search, setSearch] = useState('');

  // Debounce inputs so we don't spam the edge function while typing.
  const payload = useMemo(() => ({
    course_id: courseId === '__all__' ? null : courseId,
    batch_ids: batchIds.filter((b) => b && b !== '__all__'),
    start_time: startTime,
  }), [courseId, batchIds, startTime]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase.functions.invoke('preview-session-visibility', {
          body: payload,
        });
        if (cancelled) return;
        if (error) throw error;
        setTotal(data?.total ?? 0);
        setGroups(data?.groups ?? []);
        setStudents(data?.students ?? []);
      } catch (e: any) {
        if (cancelled) return;
        safeLogger.error('preview-session-visibility failed', e);
        setError(e?.message || 'Failed to preview visibility');
        setTotal(null);
        setGroups([]);
        setStudents([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [open, payload]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) =>
      (s.full_name || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q) ||
      (s.batch_name || '').toLowerCase().includes(q),
    );
  }, [students, search]);

  return (
    <div className="rounded-lg border border-emerald-300/70 dark:border-emerald-500/30 bg-white/70 dark:bg-background/60 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-medium text-foreground">
          <Users2 className="w-3.5 h-3.5 text-emerald-600" />
          Visibility preview
          {total !== null && !loading && (
            <Badge variant="secondary" className="text-[10px]">
              {total} student{total === 1 ? '' : 's'} will see this
            </Badge>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => setOpen((v) => !v)}
        >
          <Eye className="w-3.5 h-3.5 mr-1.5" />
          {open ? 'Hide' : 'Preview'}
        </Button>
      </div>

      {open && (
        <div className="space-y-2">
          {loading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Computing visibility…
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 text-xs text-rose-600 bg-rose-50 dark:bg-rose-500/10 rounded px-2 py-1.5">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && total === 0 && (
            <p className="text-xs text-muted-foreground">
              No students match these audience settings.
            </p>
          )}

          {!loading && !error && total !== null && total > 0 && (
            <>
              <div className="flex flex-wrap gap-1.5">
                {groups.map((g) => (
                  <Badge key={g.key} variant="outline" className="text-[10px]">
                    {g.label}: {g.count}
                  </Badge>
                ))}
              </div>

              <div className="relative">
                <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, email, batch…"
                  className="pl-7 h-8 text-xs bg-background"
                />
              </div>

              <ScrollArea className="h-48 rounded border border-border/60 bg-background">
                <div className="divide-y divide-border/60">
                  {filtered.map((s) => (
                    <div key={`${s.student_id}::${s.batch_id ?? 'nb'}`} className="px-2.5 py-1.5 flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{s.full_name || '(unknown)'}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{s.email}</div>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 shrink-0">
                        <Badge variant="outline" className="text-[10px]">{s.batch_name}</Badge>
                        {s.lms_status && s.lms_status !== 'active' && (
                          <span className="text-[10px] text-amber-600">LMS: {s.lms_status}</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {filtered.length === 0 && (
                    <div className="px-2.5 py-3 text-xs text-muted-foreground text-center">
                      No matches for "{search}".
                    </div>
                  )}
                </div>
              </ScrollArea>
              <p className="text-[10px] text-muted-foreground">
                Preview mirrors the same rules students hit at load time (course + batch + unbatched enrollment date). Nothing is saved.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
