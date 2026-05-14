import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { AtRiskRules } from './useAtRiskRules';

export type AtRiskReason = 'no_login' | 'stuck_recording' | 'stuck_assignment' | 'missed_sessions';

export interface AtRiskStudent {
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  batch_name: string | null;
  reasons: { type: AtRiskReason; detail: string }[];
  severity: 'critical' | 'warning';
  days_at_risk: number;
  resolved_at?: string | null;
}

const daysBetween = (from: Date | string | null, to = new Date()): number => {
  if (!from) return Infinity;
  const f = typeof from === 'string' ? new Date(from) : from;
  return Math.floor((to.getTime() - f.getTime()) / 86400000);
};

export function useAtRiskStudents(rules: AtRiskRules, configured: boolean) {
  const [students, setStudents] = useState<AtRiskStudent[]>([]);
  const [resolvedByTeam, setResolvedByTeam] = useState<AtRiskStudent[]>([]);
  const [resolvedByStudent, setResolvedByStudent] = useState<AtRiskStudent[]>([]);
  const [loading, setLoading] = useState(false);

  const compute = useCallback(async () => {
    if (!configured) {
      setStudents([]); setResolvedByTeam([]); setResolvedByStudent([]);
      return;
    }
    setLoading(true);
    try {
      // 1. Active students
      const { data: usersData } = await supabase
        .from('users')
        .select('id, full_name, email, phone, last_login_at, last_active_at, status, lms_status')
        .eq('role', 'student')
        .eq('lms_status', 'active')
        .limit(1000);

      const userIds = (usersData || []).map(u => u.id);
      if (userIds.length === 0) {
        setStudents([]); setLoading(false); return;
      }

      // 2. Batch info per student via course_enrollments + students
      const { data: studentsRows } = await supabase
        .from('students')
        .select('id, user_id')
        .in('user_id', userIds);
      const studentIdToUserId = new Map<string, string>((studentsRows || []).map(s => [s.id, s.user_id]));
      const studentIds = (studentsRows || []).map(s => s.id);

      const userIdToBatch = new Map<string, string>();
      if (studentIds.length) {
        const { data: enrolls } = await supabase
          .from('course_enrollments')
          .select('student_id, batch_id')
          .in('student_id', studentIds)
          .not('batch_id', 'is', null);
        const batchIds = [...new Set((enrolls || []).map(e => e.batch_id).filter(Boolean) as string[])];
        let batchNames = new Map<string, string>();
        if (batchIds.length) {
          const { data: bs } = await supabase.from('batches').select('id, name').in('id', batchIds);
          batchNames = new Map((bs || []).map(b => [b.id, b.name]));
        }
        (enrolls || []).forEach(e => {
          const uid = studentIdToUserId.get(e.student_id);
          if (uid && e.batch_id && !userIdToBatch.has(uid)) {
            userIdToBatch.set(uid, batchNames.get(e.batch_id) || '');
          }
        });
      }

      // 3. Latest unlocked recording per user (and whether watched)
      // Stuck recording: latest unlocked recording NOT yet watched after X days
      const stuckRecording = new Map<string, number>(); // user_id -> days since unlock
      // Stuck assignment: latest unlocked recording-with-assignment NOT yet submitted after X days
      const stuckAssignment = new Map<string, number>();

      if (rules.stuck_recording_days > 0 || rules.stuck_assignment_days > 0) {
        const { data: unlocks } = await supabase
          .from('user_unlocks')
          .select('user_id, recording_id, unlocked_at, is_unlocked')
          .in('user_id', userIds)
          .eq('is_unlocked', true)
          .order('unlocked_at', { ascending: false })
          .limit(10000);

        const allRecordingIds = [...new Set((unlocks || []).map(u => u.recording_id).filter(Boolean) as string[])];
        let lessonAssignmentMap = new Map<string, string | null>();
        if (allRecordingIds.length) {
          const { data: lessons } = await supabase
            .from('available_lessons')
            .select('id, assignment_id')
            .in('id', allRecordingIds);
          lessonAssignmentMap = new Map((lessons || []).map(l => [l.id, l.assignment_id]));
        }

        // Watched recordings set per user
        const watchedSet = new Map<string, Set<string>>();
        if (rules.stuck_recording_days > 0 && allRecordingIds.length) {
          const { data: views } = await supabase
            .from('recording_views')
            .select('user_id, recording_id')
            .in('user_id', userIds)
            .eq('watched', true)
            .limit(20000);
          (views || []).forEach(v => {
            if (!v.user_id || !v.recording_id) return;
            if (!watchedSet.has(v.user_id)) watchedSet.set(v.user_id, new Set());
            watchedSet.get(v.user_id)!.add(v.recording_id);
          });
        }

        // Submissions set per user (assignment_id keys)
        const submittedSet = new Map<string, Set<string>>();
        if (rules.stuck_assignment_days > 0 && studentIds.length) {
          const { data: subs } = await supabase
            .from('submissions')
            .select('student_id, assignment_id')
            .in('student_id', studentIds)
            .limit(20000);
          (subs || []).forEach(s => {
            const uid = studentIdToUserId.get(s.student_id);
            if (!uid || !s.assignment_id) return;
            if (!submittedSet.has(uid)) submittedSet.set(uid, new Set());
            submittedSet.get(uid)!.add(s.assignment_id);
          });
        }

        // Walk unlocks ordered desc; first unwatched → stuck recording; first unsubmitted assignment → stuck assignment
        const seenRecUser = new Set<string>();
        const seenAsnUser = new Set<string>();
        (unlocks || []).forEach(u => {
          if (!u.user_id || !u.recording_id || !u.unlocked_at) return;
          const days = daysBetween(u.unlocked_at);

          if (rules.stuck_recording_days > 0 && !seenRecUser.has(u.user_id)) {
            const watched = watchedSet.get(u.user_id)?.has(u.recording_id);
            if (!watched) {
              stuckRecording.set(u.user_id, days);
              seenRecUser.add(u.user_id);
            } else {
              // already watched their latest unlock → not stuck on recordings
              seenRecUser.add(u.user_id);
            }
          }

          if (rules.stuck_assignment_days > 0 && !seenAsnUser.has(u.user_id)) {
            const aid = lessonAssignmentMap.get(u.recording_id);
            if (aid) {
              const submitted = submittedSet.get(u.user_id)?.has(aid);
              if (!submitted) {
                stuckAssignment.set(u.user_id, days);
                seenAsnUser.add(u.user_id);
              } else {
                seenAsnUser.add(u.user_id);
              }
            }
          }
        });
      }


      // 5. Missed sessions count (proxy: completed sessions in last 30d minus attendance)
      const missedCounts = new Map<string, number>();
      if (rules.missed_sessions_count > 0) {
        const since = new Date(Date.now() - 60 * 86400000).toISOString();
        const { data: attended } = await supabase
          .from('session_attendance')
          .select('user_id, session_id')
          .in('user_id', userIds)
          .gte('attended_at', since);
        const attendedMap = new Map<string, Set<string>>();
        (attended || []).forEach(a => {
          if (!a.user_id || !a.session_id) return;
          if (!attendedMap.has(a.user_id)) attendedMap.set(a.user_id, new Set());
          attendedMap.get(a.user_id)!.add(a.session_id);
        });
        // Count completed sessions per batch in last 60 days
        const { data: pastSessions } = await supabase
          .from('batch_timeline_items')
          .select('id, batch_id, start_datetime')
          .gte('start_datetime', since)
          .lt('start_datetime', new Date().toISOString());
        const batchSessions = new Map<string, string[]>();
        (pastSessions || []).forEach(s => {
          if (!s.batch_id) return;
          if (!batchSessions.has(s.batch_id)) batchSessions.set(s.batch_id, []);
          batchSessions.get(s.batch_id)!.push(s.id);
        });
        // Map student -> batch -> sessions
        userIds.forEach(uid => {
          const batchName = userIdToBatch.get(uid);
          if (!batchName) return;
          // find batch_id from earlier (need reverse map)
        });
        // Simpler: iterate enrolls again
        const { data: enrolls } = await supabase
          .from('course_enrollments')
          .select('student_id, batch_id')
          .in('student_id', studentIds)
          .not('batch_id', 'is', null);
        (enrolls || []).forEach(e => {
          const uid = studentIdToUserId.get(e.student_id);
          if (!uid || !e.batch_id) return;
          const sessions = batchSessions.get(e.batch_id) || [];
          if (!sessions.length) return;
          const att = attendedMap.get(uid) || new Set();
          const missed = sessions.filter(sid => !att.has(sid)).length;
          missedCounts.set(uid, Math.max(missedCounts.get(uid) || 0, missed));
        });
      }

      // 6. Build at-risk list
      const flagged: AtRiskStudent[] = [];
      const resolved: AtRiskStudent[] = [];

      (usersData || []).forEach(u => {
        const reasons: AtRiskStudent['reasons'] = [];
        const lastLogin = u.last_login_at || u.last_active_at;
        const noLoginDays = daysBetween(lastLogin);
        if (rules.no_login_days > 0 && noLoginDays >= rules.no_login_days) {
          reasons.push({
            type: 'no_login',
            detail: noLoginDays === Infinity ? 'Never logged in' : `${noLoginDays}d no login`,
          });
        }
        if (rules.stuck_recording_days > 0) {
          const days = stuckRecording.get(u.id);
          if (days !== undefined && days >= rules.stuck_recording_days) {
            reasons.push({ type: 'stuck_recording', detail: `${days}d unwatched unlock` });
          }
        }
        if (rules.stuck_assignment_days > 0) {
          const days = stuckAssignment.get(u.id);
          if (days !== undefined && days >= rules.stuck_assignment_days) {
            reasons.push({ type: 'stuck_assignment', detail: `${days}d unsubmitted unlock` });
          }
        }
        if (rules.missed_sessions_count > 0) {
          const m = missedCounts.get(u.id) || 0;
          if (m >= rules.missed_sessions_count) {
            reasons.push({ type: 'missed_sessions', detail: `${m} missed` });
          }
        }
        if (reasons.length === 0) return;

        const days_at_risk = Math.min(
          ...reasons.map(r => {
            const m = r.detail.match(/(\d+)d/);
            return m ? parseInt(m[1]) : 0;
          }).filter(n => !isNaN(n)),
          noLoginDays === Infinity ? 999 : noLoginDays
        );
        const severity: 'critical' | 'warning' = reasons.length >= 2 || days_at_risk > 7 ? 'critical' : 'warning';

        flagged.push({
          user_id: u.id,
          name: u.full_name || u.email,
          email: u.email,
          phone: u.phone || null,
          batch_name: userIdToBatch.get(u.id) || null,
          reasons,
          severity,
          days_at_risk: isFinite(days_at_risk) ? days_at_risk : 0,
        });
      });

      setStudents(flagged);
      setResolvedByTeam(resolved);
      setResolvedByStudent([]);
    } finally {
      setLoading(false);
    }
  }, [rules, configured]);

  useEffect(() => { compute(); }, [compute]);

  return { students, resolvedByTeam, resolvedByStudent, loading, refetch: compute };
}
