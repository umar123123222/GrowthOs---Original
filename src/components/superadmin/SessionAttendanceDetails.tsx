import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Download, Loader2, Users2, UserCheck, Percent } from 'lucide-react';

interface Props {
  sessionId: string;
  sessionTitle: string;
  courseId?: string | null;
  batchIds?: string[] | null;
}

interface StudentRow {
  id: string;
  full_name: string | null;
  email: string | null;
  phone?: string | null;
}

export function SessionAttendanceDetails({ sessionId, sessionTitle, courseId, batchIds }: Props) {
  const [loading, setLoading] = useState(true);
  const [expected, setExpected] = useState<StudentRow[]>([]);
  const [attendedIds, setAttendedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // Attendance rows
        const { data: att } = await supabase
          .from('session_attendance')
          .select('user_id')
          .eq('session_id', sessionId);
        const attSet = new Set<string>((att || []).map((r: any) => r.user_id));

        // Expected students
        let userIds: string[] = [];
        const normalizedBatchIds = Array.isArray(batchIds) ? batchIds : [];
        const includesUnbatched = normalizedBatchIds.includes('unbatched');
        const realBatchIds = normalizedBatchIds.filter((b) => b !== 'unbatched');

        if (courseId || normalizedBatchIds.length > 0) {
          let query = supabase.from('course_enrollments').select('student_id, batch_id, course_id');
          if (courseId) query = query.eq('course_id', courseId);

          const { data: enrolls } = await query;
          let rows = enrolls || [];

          if (normalizedBatchIds.length > 0) {
            rows = rows.filter((r: any) => {
              if (includesUnbatched && !r.batch_id) return true;
              return realBatchIds.includes(r.batch_id);
            });
          }
          const studentIds = Array.from(new Set(rows.map((r: any) => r.student_id).filter(Boolean)));
          // Map students.id -> users.id
          if (studentIds.length > 0) {
            const chunkSize = 200;
            for (let i = 0; i < studentIds.length; i += chunkSize) {
              const chunk = studentIds.slice(i, i + chunkSize);
              const { data: studs } = await supabase
                .from('students')
                .select('user_id')
                .in('id', chunk);
              userIds = userIds.concat((studs || []).map((s: any) => s.user_id).filter(Boolean));
            }
            userIds = Array.from(new Set(userIds));
          }
        } else {
          // All active students
          const { data: allStudents } = await supabase
            .from('users')
            .select('id')
            .eq('role', 'student')
            .eq('status', 'Active');
          userIds = (allStudents || []).map((u: any) => u.id);
        }

        let studentRows: StudentRow[] = [];
        if (userIds.length > 0) {
          // chunk to avoid URL limits
          const chunkSize = 200;
          for (let i = 0; i < userIds.length; i += chunkSize) {
            const chunk = userIds.slice(i, i + chunkSize);
            const { data: users } = await supabase
              .from('users')
              .select('id, full_name, email, phone')
              .in('id', chunk);
            studentRows = studentRows.concat((users || []) as any);
          }
        }

        setExpected(studentRows);
        setAttendedIds(attSet);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [sessionId, courseId, JSON.stringify(batchIds)]);

  const total = expected.length;
  const attendedCount = expected.filter((s) => attendedIds.has(s.id)).length;
  const percentage = total > 0 ? Math.round((attendedCount / total) * 1000) / 10 : 0;
  const absentees = expected.filter((s) => !attendedIds.has(s.id));

  const downloadAbsentees = () => {
    const header = ['Full Name', 'Email', 'Phone'];
    const rows = absentees.map((s) => [
      (s.full_name || '').replace(/"/g, '""'),
      (s.email || '').replace(/"/g, '""'),
      (s.phone || '').replace(/"/g, '""'),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${c}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeTitle = sessionTitle.replace(/[^a-z0-9]+/gi, '_').slice(0, 40) || 'session';
    a.href = url;
    a.download = `${safeTitle}_absentees.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading attendance…
      </div>
    );
  }

  return (
    <div className="p-4 bg-muted/30 border-y">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-background border">
          <Users2 className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Expected</span>
          <span className="text-sm font-semibold">{total}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-background border">
          <UserCheck className="w-4 h-4 text-emerald-600" />
          <span className="text-sm text-muted-foreground">Attended</span>
          <span className="text-sm font-semibold">{attendedCount}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-background border">
          <Percent className="w-4 h-4 text-primary" />
          <span className="text-sm text-muted-foreground">Attendance</span>
          <span className="text-sm font-semibold">{percentage}%</span>
        </div>
        <div className="ml-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={downloadAbsentees}
            disabled={absentees.length === 0}
            title={absentees.length === 0 ? 'No absentees' : 'Download absentees CSV'}
          >
            <Download className="w-4 h-4 mr-2" />
            Download Absentees ({absentees.length})
          </Button>
        </div>
      </div>
    </div>
  );
}
