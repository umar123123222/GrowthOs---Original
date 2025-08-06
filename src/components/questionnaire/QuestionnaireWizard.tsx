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
  return <div className="min-h-[80vh] flex items-center justify-center p-4 py-8">
      <Card className="wizard-card w-full max-w-[560px] mx-auto shadow-xl border-0 bg-white/95 backdrop-blur-sm">
        <CardHeader className="text-center space-y-6 pb-8">
          <div className="space-y-2">
            
            <CardTitle className="text-2xl font-bold text-foreground sm:text-3xl">
              Tell us about yourself
            </CardTitle>
            <p className="text-muted-foreground text-sm">
              Just a few questions to personalize your experience
            </p>
          </div>
          
          {/* Progress Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm font-medium">
              <span className="text-primary">Step {currentStep + 1} of {totalSteps}</span>
              <span className="text-muted-foreground">{Math.round(progress)}% complete</span>
            </div>
            
            <div className="space-y-3">
              <Progress value={progress} className="h-2.5 bg-muted/50" aria-label={`Progress: ${Math.round(progress)}% complete`} aria-valuenow={currentStep + 1} aria-valuemax={totalSteps} />
              
              {/* Step Indicators */}
              <div className="flex justify-center gap-2" role="tablist" aria-label="Questionnaire steps">
                {questions.map((_, index) => <div key={index} role="tab" aria-selected={index === currentStep} aria-label={`Step ${index + 1}${index < currentStep ? ' - completed' : index === currentStep ? ' - current' : ' - upcoming'}`} className={`h-2.5 rounded-full transition-all duration-500 ${index === currentStep ? 'bg-primary w-8 shadow-sm' : index < currentStep ? 'bg-primary/80 w-2.5' : 'bg-muted w-2.5'}`} />)}
              </div>
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
                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-lg sm:text-xl font-semibold leading-relaxed block text-foreground">
                      {currentQuestion.text}
                      {currentQuestion.required && <span className="text-destructive ml-1" aria-label="required">*</span>}
                    </label>
                    {currentQuestion.required && <p className="text-sm text-muted-foreground">
                        This field is required to continue
                      </p>}
                  </div>
                  
                  <QuestionRenderer question={currentQuestion} control={form.control} error={errors[currentQuestion.id]?.message as string} />
                  
                  {/* Error Display */}
                  {errors[currentQuestion.id] && <div data-error={currentQuestion.id} aria-live="polite" className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3 animate-in slide-in-from-left-2">
                      <div className="w-1.5 h-1.5 bg-destructive rounded-full flex-shrink-0"></div>
                      {errors[currentQuestion.id]?.message as string}
                    </div>}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
          
          {/* Navigation */}
          <nav className="wizard-nav flex items-center justify-between pt-6 border-t border-border/50" aria-label="Questionnaire navigation">
            {currentStep > 0 ? <Button type="button" variant="ghost" onClick={handlePrevious} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors" aria-label="Go to previous question">
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button> : <div />}
            
            <Button type="button" onClick={handleNext} disabled={isSubmitting || isLoading} className="flex items-center gap-2 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-primary-foreground font-medium px-6 py-2.5 rounded-lg shadow-sm hover:shadow-md transition-all duration-200" aria-label={isLastStep ? "Complete questionnaire" : "Go to next question"}>
              {isSubmitting || isLoading ? <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                  {isLastStep ? 'Submitting...' : 'Loading...'}
                </> : <>
                  {isLastStep ? <>
                      <Check className="h-4 w-4" />
                      Complete
                    </> : <>
                      Continue
                      <ChevronRight className="h-4 w-4" />
                    </>}
                </>}
            </Button>
          </nav>
        </CardContent>
      </Card>
    </div>;
};