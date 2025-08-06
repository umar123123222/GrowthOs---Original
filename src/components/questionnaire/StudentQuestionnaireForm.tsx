import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { QuestionItem, QuestionnaireResponse } from '@/types/questionnaire';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { ChevronLeft, ChevronRight, Upload, Check, FileText } from 'lucide-react';

interface StudentQuestionnaireFormProps {
  questions: QuestionItem[];
  onComplete: (responses: QuestionnaireResponse[]) => void;
  isLoading?: boolean;
}

export const StudentQuestionnaireForm: React.FC<StudentQuestionnaireFormProps> = ({
  questions,
  onComplete,
  isLoading = false
}) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  
  const currentQuestion = questions[currentQuestionIndex];
  const totalQuestions = questions.length;
  const progress = ((currentQuestionIndex + 1) / totalQuestions) * 100;

  const handleFileUpload = async (questionId: string, file: File) => {
    setUploading(prev => ({ ...prev, [questionId]: true }));
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = `onboarding/${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from('assignment-files')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('assignment-files')
        .getPublicUrl(filePath);

      setResponses(prev => ({
        ...prev,
        [questionId]: {
          fileName: file.name,
          fileUrl: publicUrl,
          fileSize: file.size
        }
      }));

      setValidationErrors(prev => ({ ...prev, [questionId]: '' }));
    } catch (error) {
      toast({
        title: 'Upload Failed',
        description: 'Failed to upload file. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setUploading(prev => ({ ...prev, [questionId]: false }));
    }
  };

  const handleInputChange = (questionId: string, value: any) => {
    setResponses(prev => ({ ...prev, [questionId]: value }));
    setValidationErrors(prev => ({ ...prev, [questionId]: '' }));
  };

  const validateCurrentQuestion = (): boolean => {
    const question = currentQuestion;
    const response = responses[question.id];
    let error = '';

    if (question.required) {
      if (!response || 
          (typeof response === 'string' && !response.trim()) ||
          (Array.isArray(response) && response.length === 0)) {
        error = 'This question is required';
      }
    }

    // Validate multi-select has at least one option if not empty
    if (question.answerType === 'multiSelect' && response && Array.isArray(response) && response.length === 0) {
      error = 'Please select at least one option';
    }

    // Validate file size (max 10MB)
    if (question.answerType === 'file' && response && response.fileSize > 10 * 1024 * 1024) {
      error = 'File size must be less than 10MB';
    }

    setValidationErrors(prev => ({ ...prev, [question.id]: error }));
    return !error;
  };

  const validateAllResponses = (): boolean => {
    const errors: Record<string, string> = {};
    let isValid = true;

    questions.forEach(question => {
      const response = responses[question.id];
      
      if (question.required) {
        if (!response || 
            (typeof response === 'string' && !response.trim()) ||
            (Array.isArray(response) && response.length === 0)) {
          errors[question.id] = 'This question is required';
          isValid = false;
        }
      }
    });

    setValidationErrors(errors);
    return isValid;
  };

  const handleNext = () => {
    if (!validateCurrentQuestion()) {
      return;
    }

    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleSubmit = () => {
    if (!validateAllResponses()) {
      return;
    }

    const formattedResponses: QuestionnaireResponse[] = questions.map(question => ({
      questionId: question.id,
      value: responses[question.id] || null
    }));

    onComplete(formattedResponses);
  };

  const isCurrentQuestionAnswered = () => {
    const response = responses[currentQuestion.id];
    return response !== undefined && response !== null && response !== '';
  };

  const renderQuestion = (question: QuestionItem) => {
    const value = responses[question.id];
    const error = validationErrors[question.id];
    const isUploading = uploading[question.id];

    switch (question.answerType) {
      case 'singleLine':
        return (
          <Input
            value={value || ''}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
            placeholder="Enter your answer..."
            className={error ? 'border-destructive' : ''}
          />
        );

      case 'multiLine':
        return (
          <Textarea
            value={value || ''}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
            placeholder="Enter your answer..."
            rows={4}
            className={error ? 'border-destructive' : ''}
          />
        );

      case 'singleSelect':
        return (
          <Select
            value={value || ''}
            onValueChange={(val) => handleInputChange(question.id, val)}
          >
            <SelectTrigger className={error ? 'border-destructive' : ''}>
              <SelectValue placeholder="Select an option..." />
            </SelectTrigger>
            <SelectContent>
              {question.options?.map((option, index) => (
                <SelectItem key={index} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'multiSelect':
        return (
          <div className="space-y-3">
            {question.options?.map((option, index) => (
              <div key={index} className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                <Checkbox
                  id={`${question.id}-${index}`}
                  checked={Array.isArray(value) && value.includes(option)}
                  onCheckedChange={(checked) => {
                    const currentValues = Array.isArray(value) ? value : [];
                    if (checked) {
                      handleInputChange(question.id, [...currentValues, option]);
                    } else {
                      handleInputChange(question.id, currentValues.filter(v => v !== option));
                    }
                  }}
                />
                <Label htmlFor={`${question.id}-${index}`} className="text-sm font-medium cursor-pointer flex-1">
                  {option}
                </Label>
              </div>
            ))}
          </div>
        );

      case 'file':
        return (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
              <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <Label htmlFor={`file-${question.id}`} className="cursor-pointer">
                <span className="text-sm font-medium text-primary hover:text-primary/80">
                  Click to upload a file
                </span>
                <Input
                  id={`file-${question.id}`}
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleFileUpload(question.id, file);
                    }
                  }}
                  disabled={isUploading}
                  className="hidden"
                />
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Maximum file size: 10MB
              </p>
            </div>
            
            {isUploading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                Uploading...
              </div>
            )}
            
            {value && value.fileName && (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <FileText className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-800 font-medium">
                  {value.fileName}
                </span>
                <Check className="h-4 w-4 text-green-600 ml-auto" />
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-xl animate-fade-in">
        <CardHeader className="text-center space-y-4 pb-8">
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Welcome! Let's get to know you
          </CardTitle>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Question {currentQuestionIndex + 1} of {totalQuestions}</span>
              <span>{Math.round(progress)}% complete</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </CardHeader>
        
        <CardContent className="space-y-8 pb-8">
          <div className="animate-scale-in space-y-6">
            <div className="space-y-4">
              <Label className="text-xl font-semibold leading-relaxed block">
                {currentQuestion.text}
                {currentQuestion.required && <span className="text-destructive ml-1">*</span>}
              </Label>
              
              <div className="animate-fade-in">
                {renderQuestion(currentQuestion)}
              </div>
              
              {validationErrors[currentQuestion.id] && (
                <p className="text-sm text-destructive animate-shake">
                  {validationErrors[currentQuestion.id]}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-6 border-t">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentQuestionIndex === 0}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>

            <div className="flex gap-1">
              {questions.map((_, index) => (
                <div
                  key={index}
                  className={`h-2 w-2 rounded-full transition-all duration-300 ${
                    index === currentQuestionIndex
                      ? 'bg-primary w-8'
                      : index < currentQuestionIndex
                      ? 'bg-primary/60'
                      : 'bg-muted'
                  }`}
                />
              ))}
            </div>

            {currentQuestionIndex < totalQuestions - 1 ? (
              <Button
                onClick={handleNext}
                className="flex items-center gap-2 hover-scale"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={isLoading || Object.values(uploading).some(Boolean)}
                className="flex items-center gap-2 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 hover-scale"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Submitting...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Complete Registration
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};