import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

interface VideoBypassEnrollment {
  drip_override: boolean | null;
  drip_enabled: boolean | null;
  sequential_override: boolean | null;
  sequential_enabled: boolean | null;
}

export interface StudentVideoAccessState {
  studentRecordId: string | null;
  hasVideoBypass: boolean;
}

export const isEnrollmentVideoBypass = (enrollment: VideoBypassEnrollment) => {
  const dripDisabled = enrollment.drip_override === true && enrollment.drip_enabled === false;
  const sequentialDisabled = enrollment.sequential_override === true && enrollment.sequential_enabled === false;
  return dripDisabled || sequentialDisabled;
};

export const getStudentVideoAccessState = async (userId: string): Promise<StudentVideoAccessState> => {
  try {
    const { data: studentData, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (studentError) throw studentError;
    if (!studentData?.id) {
      return { studentRecordId: null, hasVideoBypass: false };
    }

    const { data: enrollmentsData, error: enrollmentsError } = await supabase
      .from('course_enrollments')
      .select('drip_override, drip_enabled, sequential_override, sequential_enabled')
      .eq('student_id', studentData.id)
      .eq('status', 'active');

    if (enrollmentsError) throw enrollmentsError;

    return {
      studentRecordId: studentData.id,
      hasVideoBypass: (enrollmentsData || []).some(isEnrollmentVideoBypass),
    };
  } catch (error) {
    logger.error('Failed to resolve student video access state:', error);
    return { studentRecordId: null, hasVideoBypass: false };
  }
};