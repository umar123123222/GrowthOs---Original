import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Route, 
  BookOpen, 
  CheckCircle, 
  Lock, 
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { PathwayState, PathwayCourse } from '@/hooks/useActivePathwayAccess';

interface PathwayProgressCardProps {
  pathwayState: PathwayState;
  pathwayCourses: PathwayCourse[];
  onAdvance: () => void;
  onMakeChoice: (courseId: string) => void;
  isAdvancing?: boolean;
}

export function PathwayProgressCard({
  pathwayState,
  pathwayCourses,
  onAdvance,
  onMakeChoice,
  isAdvancing = false
}: PathwayProgressCardProps) {
  const completedSteps = pathwayCourses.filter(c => c.isCompleted).length;
  const progressPercentage = pathwayState.totalSteps > 0 
    ? (completedSteps / pathwayState.totalSteps) * 100 
    : 0;

  const currentCourse = pathwayCourses.find(c => c.isCurrent);
  const canAdvance = currentCourse?.isCompleted && !pathwayState.hasPendingChoice;

  // Find choice options if at a choice point
  const choiceOptions = pathwayState.hasPendingChoice && currentCourse?.choiceOptions 
    ? currentCourse.choiceOptions 
    : null;

  return (
    <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border-primary/20 overflow-hidden">
      <CardContent className="p-4 space-y-4">
        {/* Pathway Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-primary/10">
              <Route className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{pathwayState.pathwayName}</h3>
              <p className="text-xs text-muted-foreground">
                Step {pathwayState.currentStepNumber} of {pathwayState.totalSteps}
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            Pathway Mode
          </Badge>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{Math.round(progressPercentage)}%</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>

        {/* Course Steps */}
        <div className="space-y-2">
          {pathwayCourses.slice(0, 5).map((course, index) => (
            <div 
              key={course.courseId}
              className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                course.isCurrent 
                  ? 'bg-primary/10 border border-primary/30' 
                  : course.isCompleted 
                    ? 'bg-green-50 dark:bg-green-900/20' 
                    : 'bg-muted/50'
              }`}
            >
              <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                course.isCompleted 
                  ? 'bg-green-500 text-white' 
                  : course.isCurrent 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted-foreground/20 text-muted-foreground'
              }`}>
                {course.isCompleted ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  course.stepNumber
                )}
              </div>
              <span className={`flex-1 text-sm ${
                course.isCurrent ? 'font-medium' : ''
              } ${!course.isAvailable && !course.isCompleted ? 'text-muted-foreground' : ''}`}>
                {course.courseTitle}
              </span>
              {course.isCurrent && (
                <Badge variant="outline" className="text-xs">Current</Badge>
              )}
              {!course.isAvailable && !course.isCompleted && !course.isCurrent && (
                <Lock className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          ))}
          {pathwayCourses.length > 5 && (
            <p className="text-xs text-muted-foreground text-center">
              +{pathwayCourses.length - 5} more courses
            </p>
          )}
        </div>

        {/* Choice Point UI */}
        {pathwayState.hasPendingChoice && choiceOptions && (
          <div className="space-y-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <Sparkles className="w-4 h-4" />
              <span className="font-medium text-sm">Choose Your Path</span>
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Complete the current course to unlock your choice. Select which track you want to pursue:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {choiceOptions.map((option) => (
                <Button
                  key={option.course_id}
                  variant="outline"
                  size="sm"
                  onClick={() => onMakeChoice(option.course_id)}
                  disabled={!currentCourse?.isCompleted || isAdvancing}
                  className="justify-start"
                >
                  <BookOpen className="w-4 h-4 mr-2" />
                  {option.course_title}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Advance Button (when not at choice point) */}
        {!pathwayState.hasPendingChoice && currentCourse && (
          <div className="pt-2 border-t">
            {canAdvance ? (
              <Button 
                onClick={onAdvance} 
                disabled={isAdvancing}
                className="w-full"
              >
                {isAdvancing ? (
                  'Advancing...'
                ) : (
                  <>
                    Unlock Next Course
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            ) : (
              <div className="text-center text-sm text-muted-foreground">
                <p>Complete all videos and get assignments approved to unlock the next course</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
