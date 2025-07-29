import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, FileText } from "lucide-react";

interface Assignment {
  assignment_id: string;
  assignment_title: string;
  assignment_description: string;
  due_date: string;
  sequence_order: number;
  Status: string;
  isUnlocked?: boolean;
}

interface Submission {
  assignment_id: string;
  status: string;
}

interface NextAssignmentProps {
  userId?: string;
}

export const NextAssignment = ({ userId }: NextAssignmentProps) => {
  const [nextAssignment, setNextAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (userId) {
      fetchNextAssignment();
    }
  }, [userId]);

  const fetchNextAssignment = async () => {
    try {
      if (!userId) return;

      // Check user's LMS status
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('lms_status')
        .eq('id', userId)
        .single();
      
      if (userError) throw userError;
      
      // If user is inactive, don't show any assignments
      if (userData?.lms_status !== 'active') {
        setNextAssignment(null);
        setLoading(false);
        return;
      }

      // Fetch all assignments
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('assignment')
        .select('*')
        .order('sequence_order');

      if (assignmentsError) throw assignmentsError;

      // Fetch user's submissions
      const { data: submissions, error: submissionsError } = await supabase
        .from('assignment_submissions')
        .select('assignment_id, status')
        .eq('user_id', userId);

      if (submissionsError) throw submissionsError;

      // Find the next assignment that's unlocked and not completed
      const processedAssignments = assignmentsData?.map(assignment => {
        // Check if all previous assignments are completed
        const previousAssignments = assignmentsData.filter(a => a.sequence_order < assignment.sequence_order);
        const allPreviousCompleted = previousAssignments.every(prevAssignment => {
          const submission = submissions?.find(s => s.assignment_id === prevAssignment.assignment_id);
          return submission && submission.status === 'accepted';
        });

        // First assignment is always unlocked, others need previous ones completed
        const isUnlocked = assignment.sequence_order === 1 || allPreviousCompleted;

        return {
          ...assignment,
          isUnlocked
        };
      }) || [];

      // Find the first unlocked assignment that's not completed
      const currentAssignment = processedAssignments.find(assignment => {
        const submission = submissions?.find(s => s.assignment_id === assignment.assignment_id);
        const isCompleted = submission && submission.status === 'accepted';
        return assignment.isUnlocked && !isCompleted;
      });

      setNextAssignment(currentAssignment || null);
    } catch (error) {
      console.error('Error fetching next assignment:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartAssignment = () => {
    navigate('/assignments');
  };

  if (loading) {
    return (
      <Card className="w-full max-w-sm">
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="w-5 h-5 text-orange-500" />
          Next Assignment
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col h-full space-y-4">
        {nextAssignment ? (
          <>
            <div className="flex-grow">
              <h3 className="font-medium text-sm mb-1">{nextAssignment.assignment_title}</h3>
              <p className="text-xs text-muted-foreground">
                Due: {new Date(nextAssignment.due_date).toLocaleDateString()}
              </p>
            </div>
            <Button 
              onClick={handleStartAssignment}
              className="w-full bg-blue-600 hover:bg-blue-700 mt-auto"
            >
              <FileText className="w-4 h-4 mr-2" />
              Start Assignment
            </Button>
          </>
        ) : (
          <>
            <div className="flex-grow">
              <p className="text-sm text-muted-foreground">
                No pending assignments
              </p>
            </div>
            <Button 
              onClick={handleStartAssignment}
              className="w-full bg-blue-600 hover:bg-blue-700 mt-auto"
              disabled
            >
              <FileText className="w-4 h-4 mr-2" />
              Start Assignment
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};