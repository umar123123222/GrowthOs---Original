import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QuestionItem, QuestionnaireResponse } from '@/types/questionnaire';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

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
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

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

  const validateResponses = (): boolean => {
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

      // Validate multi-select has at least one option if not empty
      if (question.answerType === 'multiSelect' && response && Array.isArray(response) && response.length === 0) {
        errors[question.id] = 'Please select at least one option';
        isValid = false;
      }

      // Validate file size (max 10MB)
      if (question.answerType === 'file' && response && response.fileSize > 10 * 1024 * 1024) {
        errors[question.id] = 'File size must be less than 10MB';
        isValid = false;
      }
    });

    setValidationErrors(errors);
    return isValid;
  };

  const handleSubmit = () => {
    if (!validateResponses()) {
      return;
    }

    const formattedResponses: QuestionnaireResponse[] = questions.map(question => ({
      questionId: question.id,
      value: responses[question.id] || null
    }));

    onComplete(formattedResponses);
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
          <div className="space-y-2">
            {question.options?.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`${question.id}-${index}`}
                  checked={Array.isArray(value) && value.includes(option)}
                  onChange={(e) => {
                    const currentValues = Array.isArray(value) ? value : [];
                    if (e.target.checked) {
                      handleInputChange(question.id, [...currentValues, option]);
                    } else {
                      handleInputChange(question.id, currentValues.filter(v => v !== option));
                    }
                  }}
                  className="rounded"
                />
                <Label htmlFor={`${question.id}-${index}`} className="text-sm">
                  {option}
                </Label>
              </div>
            ))}
          </div>
        );

      case 'file':
        return (
          <div className="space-y-2">
            <Input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFileUpload(question.id, file);
                }
              }}
              disabled={isUploading}
              className={error ? 'border-destructive' : ''}
            />
            {isUploading && (
              <p className="text-sm text-muted-foreground">Uploading...</p>
            )}
            {value && value.fileName && (
              <p className="text-sm text-muted-foreground">
                Uploaded: {value.fileName}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Maximum file size: 10MB
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome! Please answer these questions to get started</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {questions.map((question, index) => (
          <div key={question.id} className="space-y-2">
            <Label className="text-base font-medium">
              {index + 1}. {question.text}
              {question.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            
            {renderQuestion(question)}
            
            {validationErrors[question.id] && (
              <p className="text-sm text-destructive">
                {validationErrors[question.id]}
              </p>
            )}
          </div>
        ))}

        <div className="flex justify-end pt-4">
          <Button
            onClick={handleSubmit}
            disabled={isLoading || Object.values(uploading).some(Boolean)}
            size="lg"
          >
            {isLoading ? 'Submitting...' : 'Complete Registration'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};