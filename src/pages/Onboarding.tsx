import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { StudentQuestionnaireForm } from "@/components/questionnaire/StudentQuestionnaireForm";
import { supabase } from "@/integrations/supabase/client";
import { QuestionItem, QuestionnaireResponse } from "@/types/questionnaire";
import { generateDreamGoalSummary } from "@/utils/dreamGoalUtils";
interface OnboardingProps {
  user: any;
  onComplete: () => void;
}
const Onboarding = ({
  user,
  onComplete
}: OnboardingProps) => {
  const {
    toast
  } = useToast();
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const {
          data: settings,
          error
        } = await supabase.from('company_settings').select('enable_student_signin, questionnaire').eq('id', 1).single();
        if (error) {
          console.error('Error fetching company settings:', error);
          // If no settings found, assume questionnaire is disabled
          setIsEnabled(false);
          setQuestions([]);
        } else {
          setIsEnabled(settings?.enable_student_signin || false);
          if (settings?.enable_student_signin && settings?.questionnaire) {
            try {
              // Parse questionnaire if it's a string, otherwise use as-is
              const questionnaireData = typeof settings.questionnaire === 'string' ? JSON.parse(settings.questionnaire) : settings.questionnaire;
              if (Array.isArray(questionnaireData)) {
                // Sort questions by order
                const sortedQuestions = questionnaireData.sort((a, b) => a.order - b.order);
                setQuestions(sortedQuestions);
              } else {
                setQuestions([]);
              }
            } catch (parseError) {
              console.error('Error parsing questionnaire data:', parseError);
              setQuestions([]);
            }
          } else {
            setQuestions([]);
          }
        }
      } catch (error) {
        console.error('Error fetching questionnaire:', error);
        setIsEnabled(false);
        setQuestions([]);
      } finally {
        setLoading(false);
      }
    };
    fetchQuestions();
  }, []);
  const handleQuestionnaireComplete = async (responses: QuestionnaireResponse[]) => {
    setSubmitting(true);
    try {
      // 1. Save responses to user_activity_logs for audit trail
      const responsePromises = responses.map(response => {
        let answerValue = '';
        let answerData: any = {
          questionId: response.questionId
        };

        // Handle different value types
        if (response.value instanceof File) {
          answerValue = response.value.name;
          answerData.value = response.value.name;
          answerData.fileType = response.value.type;
        } else if (Array.isArray(response.value)) {
          answerValue = response.value.join(', ');
          answerData.value = response.value;
        } else {
          answerValue = String(response.value || '');
          answerData.value = response.value;
        }

        return supabase.from('user_activity_logs').insert({
          user_id: user.id,
          activity_type: 'onboarding_response',
          metadata: {
            question_type: 'dynamic_questionnaire',
            question_text: questions.find(q => q.id === response.questionId)?.text || 'Unknown question',
            answer_value: answerValue,
            answer_data: answerData
          }
        });
      });

      const results = await Promise.all(responsePromises);
      const hasErrors = results.some(result => result.error);

      if (hasErrors) {
        throw new Error('Failed to save some responses to activity logs');
      }

      // 2. Generate goal summary from answers
      const questionAnswers = responses.map((response, index) => {
        const question = questions.find(q => q.id === response.questionId);
        let answerText = '';
        
        if (Array.isArray(response.value)) {
          answerText = response.value.join(', ');
        } else if (response.value instanceof File) {
          answerText = response.value.name;
        } else {
          answerText = String(response.value || '');
        }

        return {
          id: response.questionId,
          questionText: question?.text || '',
          answer: answerText,
          order: question?.order || index
        };
      });

      const goalBrief = generateDreamGoalSummary(questionAnswers) || 'Goal set from questionnaire completion';

      // 3. Prepare answers JSON for storage
      const answersJson = responses.reduce((acc, response) => {
        const question = questions.find(q => q.id === response.questionId);
        acc[response.questionId] = {
          questionText: question?.text || '',
          value: response.value,
          order: question?.order || 0
        };
        return acc;
      }, {} as Record<string, any>);

      // 4. Update students table with completion data
      const { error: studentError } = await supabase
        .from('students')
        .update({
          onboarding_completed: true,
          answers_json: answersJson,
          goal_brief: goalBrief,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (studentError) {
        throw new Error(`Failed to update student record: ${studentError.message}`);
      }

      // 5. Also update user profile with dream goal summary for backward compatibility
      const { error: userError } = await supabase
        .from('users')
        .update({
          dream_goal_summary: goalBrief
        })
        .eq('id', user.id);

      if (userError) {
        console.error('Warning: Failed to update user profile:', userError);
        // Don't throw here as student record is the primary source
      }

      // 6. Show success message
      toast({
        title: "Welcome to your learning journey!",
        description: "Your ultimate goal has been set. Let's achieve it together!"
      });

      // 7. Navigate to dashboard
      setTimeout(() => {
        onComplete();
      }, 1500); // Brief delay to show the success message

      // 8. Safety net - force navigation after 4 seconds if something stalls
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 4000);

    } catch (error: any) {
      console.error('Onboarding completion error:', error);
      toast({
        variant: "destructive",
        title: "Could not save your answers",
        description: error.message || "Please try again."
      });
    } finally {
      setSubmitting(false);
    }
  };

  // If loading, show loading state
  if (loading) {
    return <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl shadow-elevated border-0">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading questionnaire...</p>
          </CardContent>
        </Card>
      </div>;
  }

  // If questionnaire is disabled or no questions, skip onboarding
  if (!isEnabled || questions.length === 0) {
    // Auto-complete onboarding since there are no questions
    const completeOnboarding = async () => {
      try {
        // users table doesn't have onboarding_done field, skip update
        const error = null;
        if (error) {
          console.error('Error completing onboarding:', error);
        }
      } catch (error) {
        console.error('Error completing onboarding:', error);
      } finally {
        onComplete();
      }
    };

    // Auto-complete immediately
    completeOnboarding();
    return null;
  }
  return <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-elevated border-0">
        
        
        <CardContent className="bg-slate-50">
          <StudentQuestionnaireForm questions={questions} onComplete={handleQuestionnaireComplete} isLoading={submitting} />
        </CardContent>
      </Card>
    </div>;
};
export default Onboarding;