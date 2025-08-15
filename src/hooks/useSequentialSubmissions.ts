import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger';

interface SubmissionHistory {
  id: string;
  version: number;
  content: string;
  status: 'pending' | 'approved' | 'declined';
  created_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  notes?: string;
}

interface AssignmentWithHistory {
  assignment_id: string;
  assignment_name: string;
  recording_id?: string;
  current_status: 'pending' | 'approved' | 'declined' | 'not_submitted';
  latest_version: number;
  submissions: SubmissionHistory[];
  can_resubmit: boolean;
}

export const useSequentialSubmissions = (assignmentId?: string) => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<AssignmentWithHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchSubmissionHistory();
    }
  }, [user?.id, assignmentId]);

  const fetchSubmissionHistory = async () => {
    if (!user?.id) return;

    try {
      let query = supabase
        .from('assignments')
        .select(`
          id,
          name,
          recording_id,
          submissions!inner(
            id,
            version,
            content,
            status,
            created_at,
            reviewed_at,
            reviewed_by,
            notes
          )
        `)
        .eq('submissions.student_id', user.id);

      if (assignmentId) {
        query = query.eq('id', assignmentId);
      }

      const { data: assignmentData, error } = await query;

      if (error) throw error;

      const processedAssignments: AssignmentWithHistory[] = (assignmentData || []).map(assignment => {
        const submissions = assignment.submissions || [];
        const sortedSubmissions = submissions.sort((a, b) => b.version - a.version);
        const latestSubmission = sortedSubmissions[0];
        
        return {
          assignment_id: assignment.id,
          assignment_name: assignment.name,
          recording_id: assignment.recording_id,
          current_status: latestSubmission?.status || 'not_submitted',
          latest_version: latestSubmission?.version || 0,
          submissions: sortedSubmissions,
          can_resubmit: latestSubmission?.status === 'declined' || !latestSubmission
        };
      });

      setAssignments(processedAssignments);

    } catch (error) {
      logger.error('Error fetching submission history:', error);
    } finally {
      setLoading(false);
    }
  };

  const submitAssignment = async (assignmentId: string, content: string) => {
    if (!user?.id) return { success: false, error: 'User not found' };

    try {
      // Get current assignment data
      const currentAssignment = assignments.find(a => a.assignment_id === assignmentId);
      const nextVersion = (currentAssignment?.latest_version || 0) + 1;

      // Insert new submission
      const { error } = await supabase
        .from('submissions')
        .insert({
          assignment_id: assignmentId,
          student_id: user.id,
          content,
          version: nextVersion,
          status: 'pending'
        });

      if (error) throw error;

      // Refresh data
      await fetchSubmissionHistory();

      return { success: true };
    } catch (error) {
      logger.error('Error submitting assignment:', error);
      return { success: false, error: 'Failed to submit assignment' };
    }
  };

  const getAssignmentHistory = (assignmentId: string): AssignmentWithHistory | undefined => {
    return assignments.find(a => a.assignment_id === assignmentId);
  };

  return {
    assignments,
    loading,
    submitAssignment,
    getAssignmentHistory,
    refreshHistory: fetchSubmissionHistory
  };
};