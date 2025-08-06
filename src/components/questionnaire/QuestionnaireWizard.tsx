import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, AnimatePresence } from 'framer-motion';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QuestionItem, QuestionnaireResponse } from '@/types/questionnaire';
import { QuestionRenderer } from './QuestionRenderer';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
interface QuestionnaireWizardProps {
  questions: QuestionItem[];
  onComplete: (responses: QuestionnaireResponse[]) => void;
  isLoading?: boolean;
}

// Create dynamic schema based on questions
const createQuestionnaireSchema = (questions: QuestionItem[]) => {
  const schemaObject: Record<string, z.ZodTypeAny> = {};
  questions.forEach(question => {
    let fieldSchema: z.ZodTypeAny;
    switch (question.answerType) {
      case 'singleLine':
      case 'multiLine':
        fieldSchema = z.string();
        break;
      case 'singleSelect':
        fieldSchema = z.string();
        break;
      case 'multiSelect':
        fieldSchema = z.array(z.string()).min(0);
        break;
      case 'file':
        fieldSchema = z.object({
          fileName: z.string(),
          fileUrl: z.string(),
          fileSize: z.number()
        }).nullable();
        break;
      default:
        fieldSchema = z.any();
    }
    if (question.required) {
      if (question.answerType === 'multiSelect') {
        fieldSchema = (fieldSchema as z.ZodArray<any>).min(1, 'Please select at least one option');
      } else if (question.answerType === 'file') {
        fieldSchema = fieldSchema.refine(val => val !== null, 'File is required');
      } else {
        fieldSchema = (fieldSchema as z.ZodString).min(1, 'This field is required');
      }
    } else {
      fieldSchema = fieldSchema.optional();
    }
    schemaObject[question.id] = fieldSchema;
  });
  return z.object(schemaObject);
};

// Local storage key
const STORAGE_KEY = 'questionnaire-wizard-data';
export const QuestionnaireWizard: React.FC<QuestionnaireWizardProps> = ({
  questions,
  onComplete,
  isLoading = false
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const stepRef = useRef<HTMLDivElement>(null);
  const schema = createQuestionnaireSchema(questions);

  // Load saved data from localStorage
  const loadSavedData = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.answers || {};
      }
    } catch (error) {
      console.warn('Failed to load saved questionnaire data:', error);
    }
    return {};
  };
  const form = useForm({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: loadSavedData()
  });
  const {
    formState: {
      isValid,
      errors
    },
    watch,
    trigger
  } = form;
  const currentQuestion = questions[currentStep];
  const totalSteps = questions.length;
  const progress = (currentStep + 1) / totalSteps * 100;
  const isLastStep = currentStep === totalSteps - 1;

  // Watch all form values to save to localStorage
  const watchedValues = watch();

  // Save to localStorage whenever form values change
  useEffect(() => {
    const saveData = {
      answers: watchedValues,
      currentStep,
      timestamp: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
  }, [watchedValues, currentStep]);

  // Focus management
  useEffect(() => {
    if (stepRef.current) {
      const firstInput = stepRef.current.querySelector('input, select, textarea, button') as HTMLElement;
      if (firstInput) {
        setTimeout(() => {
          firstInput.focus();
        }, 300); // Wait for animation
      }
    }
  }, [currentStep]);

  // Check if current step is valid
  const isCurrentStepValid = async () => {
    if (!currentQuestion.required) return true;
    const result = await trigger(currentQuestion.id);
    return result && !errors[currentQuestion.id];
  };
  const handleNext = async () => {
    const stepValid = await isCurrentStepValid();
    if (!stepValid) {
      // Announce error for screen readers
      const errorElement = document.querySelector(`[data-error="${currentQuestion.id}"]`);
      if (errorElement) {
        errorElement.setAttribute('aria-live', 'assertive');
      }
      return;
    }
    if (isLastStep) {
      await handleSubmit();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };
  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };
  const handleSubmit = async () => {
    const isFormValid = await trigger();
    if (!isFormValid) {
      toast({
        title: 'Please complete all required fields',
        description: 'Some questions still need to be answered.',
        variant: 'destructive'
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const formData = form.getValues();
      const responses: QuestionnaireResponse[] = questions.map(question => ({
        questionId: question.id,
        value: formData[question.id] || null
      }));
      await onComplete(responses);

      // Clear saved data on successful submission
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Submission error:', error);
      toast({
        title: 'Submission failed',
        description: 'Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Animation variants
  const stepVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 50 : -50,
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 50 : -50,
      opacity: 0
    })
  };
  return <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background flex items-center justify-center p-4 px-0 py-0">
      <Card className="wizard-card w-full max-w-[560px] mx-auto shadow-lg">
        <CardHeader className="text-center space-y-6 pb-8">
          <CardTitle className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Welcome! Let's get to know you
          </CardTitle>
          
          {/* Progress Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Question {currentStep + 1} of {totalSteps}</span>
              <span>{Math.round(progress)}% complete</span>
            </div>
            
            <Progress value={progress} className="h-2" aria-label={`Progress: ${Math.round(progress)}% complete`} aria-valuenow={currentStep + 1} aria-valuemax={totalSteps} />
            
            {/* Step Indicators */}
            <div className="flex justify-center gap-1" role="tablist" aria-label="Questionnaire steps">
              {questions.map((_, index) => <div key={index} role="tab" aria-selected={index === currentStep} aria-label={`Step ${index + 1}`} className={`h-2 rounded-full transition-all duration-300 ${index === currentStep ? 'bg-primary w-8' : index < currentStep ? 'bg-primary/60 w-2' : 'bg-muted w-2'}`} />)}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-8 pb-8">
          {/* Question Content */}
          <div className="relative overflow-hidden">
            <AnimatePresence mode="wait" custom={1}>
              <motion.div key={currentStep} ref={stepRef} custom={1} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{
              x: {
                type: "spring",
                stiffness: 300,
                damping: 30
              },
              opacity: {
                duration: 0.25
              }
            }} className="space-y-6">
                <div className="space-y-4">
                  <label className="text-lg sm:text-xl font-semibold leading-relaxed block">
                    {currentQuestion.text}
                    {currentQuestion.required && <span className="text-destructive ml-1" aria-label="required">*</span>}
                  </label>
                  
                  <QuestionRenderer question={currentQuestion} control={form.control} error={errors[currentQuestion.id]?.message as string} />
                  
                  {/* Error Display */}
                  {errors[currentQuestion.id] && <div data-error={currentQuestion.id} aria-live="polite" className="text-sm text-destructive animate-shake">
                      {errors[currentQuestion.id]?.message as string}
                    </div>}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
          
          {/* Navigation */}
          <nav className="wizard-nav flex items-center justify-between pt-6 border-t" aria-label="Questionnaire navigation">
            {currentStep > 0 ? <Button type="button" variant="outline" onClick={handlePrevious} className="flex items-center gap-2" aria-label="Go to previous question">
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button> : <div />}
            
            <Button type="button" onClick={handleNext} disabled={isSubmitting || isLoading} className="flex items-center gap-2 hover-scale" aria-label={isLastStep ? "Complete questionnaire" : "Go to next question"}>
              {isSubmitting || isLoading ? <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                  {isLastStep ? 'Submitting...' : 'Loading...'}
                </> : <>
                  {isLastStep ? <>
                      <Check className="h-4 w-4" />
                      Complete Registration
                    </> : <>
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </>}
                </>}
            </Button>
          </nav>
        </CardContent>
      </Card>
    </div>;
};