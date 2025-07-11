import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  Brain, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Award,
  RotateCcw
} from "lucide-react";

interface QuizQuestion {
  id: string;
  question_text: string;
  options: any;
  correct_option: string;
  explanation: string;
  module_id: string;
  module?: {
    title: string;
  };
}

interface QuizAttempt {
  id: string;
  question_id: string;
  module_id: string;
  selected_option: string;
  is_correct: boolean;
  attempt_number: number;
  attempted_at: string;
}

interface Module {
  id: string;
  title: string;
}

const Quizzes = () => {
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchModules();
    fetchAttempts();
  }, []);

  useEffect(() => {
    if (selectedModule) {
      fetchQuestions();
    }
  }, [selectedModule]);

  const fetchModules = async () => {
    try {
      const { data, error } = await supabase
        .from('modules')
        .select('id, title')
        .order('order');

      if (error) throw error;
      setModules(data || []);
    } catch (error) {
      console.error('Error fetching modules:', error);
    }
  };

  const fetchQuestions = async () => {
    if (!selectedModule) return;

    try {
      const { data, error } = await supabase
        .from('quiz_questions')
        .select(`
          *,
          module:modules(title)
        `)
        .eq('module_id', selectedModule);

      if (error) throw error;
      setQuestions(data || []);
      setCurrentQuestionIndex(0);
      setSelectedAnswer("");
      setShowResult(false);
      setQuizCompleted(false);
    } catch (error) {
      console.error('Error fetching questions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttempts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('user_id', user.id)
        .order('attempted_at', { ascending: false });

      if (error) throw error;
      setAttempts(data || []);
    } catch (error) {
      console.error('Error fetching attempts:', error);
    }
  };

  const submitAnswer = async () => {
    if (!selectedAnswer || !questions[currentQuestionIndex]) return;

    const question = questions[currentQuestionIndex];
    const isCorrect = selectedAnswer === question.correct_option;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const { error } = await supabase
        .from('quiz_attempts')
        .insert({
          user_id: user.id,
          module_id: selectedModule!,
          question_id: question.id,
          selected_option: selectedAnswer,
          is_correct: isCorrect,
          attempt_number: 1
        });

      if (error) throw error;

      setShowResult(true);
      fetchAttempts();

      setTimeout(() => {
        if (currentQuestionIndex < questions.length - 1) {
          setCurrentQuestionIndex(prev => prev + 1);
          setSelectedAnswer("");
          setShowResult(false);
        } else {
          setQuizCompleted(true);
          calculateScore();
        }
      }, 2000);

    } catch (error) {
      console.error('Error submitting answer:', error);
      toast({
        title: "Error",
        description: "Failed to submit answer",
        variant: "destructive",
      });
    }
  };

  const calculateScore = () => {
    const moduleAttempts = attempts.filter(a => a.module_id === selectedModule);
    const correctAnswers = moduleAttempts.filter(a => a.is_correct).length;
    const totalQuestions = questions.length;
    const percentage = Math.round((correctAnswers / totalQuestions) * 100);

    toast({
      title: "Quiz Completed!",
      description: `Your score: ${percentage}% (${correctAnswers}/${totalQuestions})`,
    });
  };

  const restartQuiz = () => {
    setCurrentQuestionIndex(0);
    setSelectedAnswer("");
    setShowResult(false);
    setQuizCompleted(false);
  };

  const getModuleScore = (moduleId: string) => {
    const moduleAttempts = attempts.filter(a => a.module_id === moduleId);
    if (moduleAttempts.length === 0) return null;
    
    const correct = moduleAttempts.filter(a => a.is_correct).length;
    const total = moduleAttempts.length;
    return Math.round((correct / total) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!selectedModule) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Quiz System</h1>
          <p className="text-muted-foreground">
            Test your knowledge with module quizzes
          </p>
        </div>

        <div className="grid gap-4">
          {modules.map((module) => {
            const score = getModuleScore(module.id);
            return (
              <Card key={module.id} className="hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => setSelectedModule(module.id)}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Brain className="w-6 h-6 text-blue-600" />
                      <div>
                        <h3 className="font-semibold">{module.title}</h3>
                        <p className="text-sm text-gray-600">Module Quiz</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {score !== null ? (
                        <Badge variant={score >= 70 ? "default" : "secondary"}>
                          {score}% Score
                        </Badge>
                      ) : (
                        <Badge variant="outline">Not Attempted</Badge>
                      )}
                      <Button size="sm">Start Quiz</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  if (quizCompleted) {
    const moduleAttempts = attempts.filter(a => a.module_id === selectedModule);
    const correctAnswers = moduleAttempts.filter(a => a.is_correct).length;
    const percentage = Math.round((correctAnswers / questions.length) * 100);

    return (
      <div className="space-y-6 animate-fade-in text-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8">
            <Award className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
            <h2 className="text-2xl font-bold mb-2">Quiz Completed!</h2>
            <p className="text-4xl font-bold text-blue-600 mb-2">{percentage}%</p>
            <p className="text-gray-600 mb-6">
              {correctAnswers} out of {questions.length} questions correct
            </p>
            <div className="space-y-2">
              <Button onClick={restartQuiz} className="w-full">
                <RotateCcw className="w-4 h-4 mr-2" />
                Retake Quiz
              </Button>
              <Button variant="outline" onClick={() => setSelectedModule(null)} className="w-full">
                Back to Modules
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  if (!currentQuestion) {
    return (
      <div className="text-center py-12">
        <Brain className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <h3 className="text-lg font-medium mb-2">No Quiz Questions</h3>
        <p className="text-gray-600">This module doesn't have quiz questions yet</p>
        <Button onClick={() => setSelectedModule(null)} className="mt-4">
          Back to Modules
        </Button>
      </div>
    );
  }

  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Quiz: {currentQuestion.module?.title}</h1>
          <p className="text-gray-600">Question {currentQuestionIndex + 1} of {questions.length}</p>
        </div>
        <Button variant="outline" onClick={() => setSelectedModule(null)}>
          Back to Modules
        </Button>
      </div>

      <Progress value={progress} className="h-2" />

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5" />
            {currentQuestion.question_text}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {!showResult ? (
            <>
              <RadioGroup value={selectedAnswer} onValueChange={setSelectedAnswer}>
                {Object.entries(currentQuestion.options).map(([key, value]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <RadioGroupItem value={key} id={key} />
                    <Label htmlFor={key} className="cursor-pointer">
                      {value as string}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              
              <Button 
                onClick={submitAnswer}
                disabled={!selectedAnswer}
                className="w-full"
              >
                Submit Answer
              </Button>
            </>
          ) : (
            <div className="text-center space-y-4">
              {selectedAnswer === currentQuestion.correct_option ? (
                <div className="text-green-600">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2" />
                  <h3 className="text-lg font-bold">Correct!</h3>
                </div>
              ) : (
                <div className="text-red-600">
                  <XCircle className="w-12 h-12 mx-auto mb-2" />
                  <h3 className="text-lg font-bold">Incorrect</h3>
                  <p className="text-sm">
                    Correct answer: {currentQuestion.options[currentQuestion.correct_option]}
                  </p>
                </div>
              )}
              
              {currentQuestion.explanation && (
                <div className="bg-blue-50 p-4 rounded-lg text-left">
                  <h4 className="font-medium mb-2">Explanation:</h4>
                  <p className="text-sm text-blue-800">{currentQuestion.explanation}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Quizzes;