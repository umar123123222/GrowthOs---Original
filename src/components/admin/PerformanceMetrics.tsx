import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Video, DollarSign, UserMinus, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface MetricValue {
  current: number; // percentage 0-100
  previous: number;
  loading: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Attendance Rate: attended rows / (completed sessions × active students)
const fetchAttendanceRate = async (startISO: string, endISO: string): Promise<number> => {
  const { data: sessions } = await supabase
    .from('success_sessions')
    .select('id, schedule_date, status')
    .gte('schedule_date', startISO)
    .lt('schedule_date', endISO)
    .in('status', ['completed', 'live']);

  const sessionIds = (sessions || []).map((s: any) => s.id);
  if (sessionIds.length === 0) return 0;

  // count attendance rows for these sessions
  let attendedTotal = 0;
  const chunkSize = 200;
  for (let i = 0; i < sessionIds.length; i += chunkSize) {
    const chunk = sessionIds.slice(i, i + chunkSize);
    const { count } = await supabase
      .from('session_attendance')
      .select('id', { count: 'exact', head: true })
      .in('session_id', chunk);
    attendedTotal += count || 0;
  }

  const { count: activeStudents } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'student')
    .ilike('status', 'active');

  const expected = sessionIds.length * (activeStudents || 0);
  if (expected === 0) return 0;
  return Math.min(100, (attendedTotal / expected) * 100);
};

// Refund Rate: refunded invoices in period / issued invoices in period
const fetchRefundRate = async (startISO: string, endISO: string): Promise<number> => {
  const { count: refunded } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .not('refunded_at', 'is', null)
    .gte('refunded_at', startISO)
    .lt('refunded_at', endISO);

  const { count: issued } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .gte('issue_date', startISO)
    .lt('issue_date', endISO)
    .in('status', ['paid', 'refunded', 'due']);

  if (!issued) return 0;
  return ((refunded || 0) / issued) * 100;
};

// Dropout Rate (excluding batches whose installments are not yet overdue):
// Consider only students who have at least one overdue installment as of period end.
// Dropout = those students who are currently suspended/refunded/inactive.
const fetchDropoutRate = async (asOfISO: string): Promise<number> => {
  // Pull overdue invoices as of `asOfISO` (invoices carry due_date & extended_due_date)
  const { data: overdue } = await supabase
    .from('invoices')
    .select('student_id, due_date, extended_due_date, status')
    .neq('status', 'paid')
    .lt('due_date', asOfISO);

  const studentIds = Array.from(
    new Set(
      (overdue || [])
        .filter((r: any) => {
          const eff = r.extended_due_date || r.due_date;
          return eff && new Date(eff).toISOString() < asOfISO;
        })
        .map((r: any) => r.student_id)
        .filter(Boolean)
    )
  );
  if (studentIds.length === 0) return 0;

  // invoices.student_id -> students.id ; map to users via students.user_id
  const userIds: string[] = [];
  const chunkSize = 200;
  for (let i = 0; i < studentIds.length; i += chunkSize) {
    const chunk = studentIds.slice(i, i + chunkSize);
    const { data: studs } = await supabase
      .from('students')
      .select('user_id')
      .in('id', chunk);
    (studs || []).forEach((s: any) => s.user_id && userIds.push(s.user_id));
  }
  const uniqueUsers = Array.from(new Set(userIds));
  if (uniqueUsers.length === 0) return 0;

  let dropped = 0;
  for (let i = 0; i < uniqueUsers.length; i += chunkSize) {
    const chunk = uniqueUsers.slice(i, i + chunkSize);
    const { count } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .in('id', chunk)
      .or('lms_status.in.(suspended,refunded,inactive),status.ilike.suspended');
    dropped += count || 0;
  }

  return (dropped / uniqueUsers.length) * 100;
};

const TrendBadge = ({ delta, invert = false }: { delta: number; invert?: boolean }) => {
  const abs = Math.abs(delta);
  const isFlat = abs < 0.1;
  const isUp = delta > 0;
  // For attendance: up = good (green). For refund/dropout: up = bad (red) — set invert=true.
  const good = invert ? !isUp : isUp;
  const color = isFlat
    ? 'text-gray-500 bg-gray-100'
    : good
    ? 'text-emerald-700 bg-emerald-100'
    : 'text-rose-700 bg-rose-100';
  const Icon = isFlat ? Minus : isUp ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>
      <Icon className="w-3 h-3" />
      {isFlat ? '0.0' : abs.toFixed(1)}%
    </span>
  );
};

const TrendBar = ({ value, previous, invert = false }: { value: number; previous: number; invert?: boolean }) => {
  const max = Math.max(value, previous, 5);
  const currentPct = (value / max) * 100;
  const prevPct = (previous / max) * 100;
  const delta = value - previous;
  const good = invert ? delta <= 0 : delta >= 0;
  const barColor = good ? 'bg-emerald-500' : 'bg-rose-500';
  return (
    <div className="space-y-1.5 mt-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full ${barColor} transition-all`} style={{ width: `${currentPct}%` }} />
        </div>
        <span className="text-[10px] text-gray-500 w-16 text-right">now</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-gray-300 transition-all" style={{ width: `${prevPct}%` }} />
        </div>
        <span className="text-[10px] text-gray-500 w-16 text-right">prev 30d</span>
      </div>
    </div>
  );
};

export const PerformanceMetrics = () => {
  const [attendance, setAttendance] = useState<MetricValue>({ current: 0, previous: 0, loading: true });
  const [refund, setRefund] = useState<MetricValue>({ current: 0, previous: 0, loading: true });
  const [dropout, setDropout] = useState<MetricValue>({ current: 0, previous: 0, loading: true });

  useEffect(() => {
    const now = new Date();
    const d30 = new Date(now.getTime() - 30 * DAY_MS);
    const d60 = new Date(now.getTime() - 60 * DAY_MS);
    const nowISO = now.toISOString();
    const d30ISO = d30.toISOString();
    const d60ISO = d60.toISOString();

    (async () => {
      try {
        const [cur, prev] = await Promise.all([
          fetchAttendanceRate(d30ISO, nowISO),
          fetchAttendanceRate(d60ISO, d30ISO),
        ]);
        setAttendance({ current: cur, previous: prev, loading: false });
      } catch (e) {
        console.error('attendance rate error', e);
        setAttendance((s) => ({ ...s, loading: false }));
      }
    })();

    (async () => {
      try {
        const [cur, prev] = await Promise.all([
          fetchRefundRate(d30ISO, nowISO),
          fetchRefundRate(d60ISO, d30ISO),
        ]);
        setRefund({ current: cur, previous: prev, loading: false });
      } catch (e) {
        console.error('refund rate error', e);
        setRefund((s) => ({ ...s, loading: false }));
      }
    })();

    (async () => {
      try {
        const [cur, prev] = await Promise.all([
          fetchDropoutRate(nowISO),
          fetchDropoutRate(d30ISO),
        ]);
        setDropout({ current: cur, previous: prev, loading: false });
      } catch (e) {
        console.error('dropout rate error', e);
        setDropout((s) => ({ ...s, loading: false }));
      }
    })();
  }, []);

  const renderCard = (
    title: string,
    subtitle: string,
    metric: MetricValue,
    Icon: React.ElementType,
    color: { border: string; text: string; iconBg: string; iconText: string; bg: string },
    invert = false
  ) => {
    const delta = metric.current - metric.previous;
    return (
      <Card className={`border-l-4 ${color.border} bg-gradient-to-br ${color.bg} shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105`}>
        <CardHeader className="pb-3">
          <CardTitle className={`text-sm font-semibold ${color.text} flex items-center gap-2`}>
            <div className={`p-2 ${color.iconBg} rounded-lg`}>
              <Icon className={`w-4 h-4 ${color.iconText}`} />
            </div>
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {metric.loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-3">
              <Loader2 className="w-4 h-4 animate-spin" /> Computing…
            </div>
          ) : (
            <>
              <div className="flex items-baseline gap-2 mb-1">
                <div className={`text-4xl font-bold ${color.text}`}>{metric.current.toFixed(1)}%</div>
                <TrendBadge delta={delta} invert={invert} />
              </div>
              <p className={`text-sm ${color.text} font-medium opacity-70`}>{subtitle}</p>
              <TrendBar value={metric.current} previous={metric.previous} invert={invert} />
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {renderCard(
        'Live Session Attendance',
        'Last 30 days',
        attendance,
        Video,
        {
          border: 'border-l-cyan-500',
          text: 'text-cyan-700',
          iconBg: 'bg-cyan-100',
          iconText: 'text-cyan-600',
          bg: 'from-cyan-50 via-cyan-25 to-white',
        },
        false
      )}
      {renderCard(
        'Refund Rate',
        'Refunded / issued (30d)',
        refund,
        DollarSign,
        {
          border: 'border-l-amber-500',
          text: 'text-amber-700',
          iconBg: 'bg-amber-100',
          iconText: 'text-amber-600',
          bg: 'from-amber-50 via-amber-25 to-white',
        },
        true
      )}
      {renderCard(
        'Dropout Rate',
        'Overdue students only',
        dropout,
        UserMinus,
        {
          border: 'border-l-rose-500',
          text: 'text-rose-700',
          iconBg: 'bg-rose-100',
          iconText: 'text-rose-600',
          bg: 'from-rose-50 via-rose-25 to-white',
        },
        true
      )}
    </div>
  );
};
