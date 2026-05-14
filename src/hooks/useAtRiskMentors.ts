import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MentorInfo {
  id: string;
  full_name: string;
  email: string;
}

export function useAtRiskMentors(studentUserIds: string[]) {
  const [mentorMap, setMentorMap] = useState<Map<string, MentorInfo | null>>(new Map());
  const [allMentors, setAllMentors] = useState<MentorInfo[]>([]);

  const load = useCallback(async () => {
    // Load all mentors
    const { data: mentors } = await supabase
      .from('users')
      .select('id, full_name, email')
      .eq('role', 'mentor')
      .order('full_name');
    const mentorsList: MentorInfo[] = (mentors || []).map(m => ({
      id: m.id,
      full_name: m.full_name || m.email,
      email: m.email,
    }));
    setAllMentors(mentorsList);
    const mentorById = new Map(mentorsList.map(m => [m.id, m]));

    if (studentUserIds.length === 0) {
      setMentorMap(new Map());
      return;
    }
    const { data: assignments } = await (supabase as any)
      .from('student_mentor_assignments')
      .select('student_id, mentor_id')
      .in('student_id', studentUserIds);
    const map = new Map<string, MentorInfo | null>();
    studentUserIds.forEach(uid => map.set(uid, null));
    (assignments || []).forEach((a: any) => {
      map.set(a.student_id, mentorById.get(a.mentor_id) || null);
    });
    setMentorMap(map);
  }, [studentUserIds.join(',')]);

  useEffect(() => { load(); }, [load]);

  const assignMentor = async (studentId: string, mentorId: string | null, assignedBy: string) => {
    if (!mentorId) {
      const { error } = await (supabase as any)
        .from('student_mentor_assignments')
        .delete()
        .eq('student_id', studentId);
      if (error) return false;
    } else {
      const { error } = await (supabase as any)
        .from('student_mentor_assignments')
        .upsert(
          { student_id: studentId, mentor_id: mentorId, assigned_by: assignedBy, assigned_at: new Date().toISOString() },
          { onConflict: 'student_id' }
        );
      if (error) return false;
    }
    await load();
    return true;
  };

  return { mentorMap, allMentors, assignMentor, refetch: load };
}
