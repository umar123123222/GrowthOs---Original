# Quiz & Assessment System

## Overview

The Quiz & Assessment system provides module-based quizzes, interactive assessments, and progress tracking to evaluate student understanding and reinforce learning objectives.

## User-Facing Behavior

### For Students
- **Module Quizzes**: Complete assessments at the end of each learning module
- **Interactive Questions**: Multiple choice, single select, and various question types
- **Immediate Feedback**: Get instant results and explanations for quiz answers
- **Progress Tracking**: View quiz scores and completion history
- **Retake Options**: Attempt quizzes multiple times to improve scores

### For Mentors
- **Student Assessment Review**: Monitor student quiz performance and identify knowledge gaps
- **Progress Analytics**: Track assessment completion rates and score trends
- **Personalized Support**: Provide targeted help based on quiz results

### For Admins/Superadmins
- **Quiz Creation**: Design and configure module-based assessments
- **Question Management**: Create, edit, and organize quiz questions
- **Performance Analytics**: Analyze quiz effectiveness and student outcomes
- **Assessment Configuration**: Set quiz parameters and grading criteria

## Technical Implementation

### Core Components
- `src/components/questionnaire/QuestionEditor.tsx` - Quiz question creation interface
- `src/pages/Quizzes.tsx` - Student quiz interface
- Quiz functionality integrated into module completion workflow

### Database Tables
- `quiz_questions` - Question content and configuration
- `quiz_attempts` - Student quiz attempt records
- `modules` - Module-based quiz association (`quiz_questions` JSONB field)
- `progress` - Quiz completion tracking

### Database Functions
```sql
-- Quiz validation and management
validate_questionnaire_structure(questionnaire_data)
-- Module completion tracking includes quiz results
is_module_completed(user_id, module_id)
```

### Question Types
```typescript
// Supported question formats
const QUESTION_TYPES = {
  'singleSelect': 'Single choice selection',
  'multiSelect': 'Multiple choice selection', 
  'singleLine': 'Short text answer',
  'multiLine': 'Long text answer',
  'file': 'File upload response'
};
```

## Configuration Matrix

### Environment Variables
| Variable | Purpose | Default | Required |
|----------|---------|---------|----------|
| No specific environment variables | Quiz data stored in database | N/A | N/A |

### Quiz Configuration
| Setting | Purpose | Default | Location |
|---------|---------|---------|----------|
| Passing score | Minimum score to pass | 70% | Module settings |
| Attempt limit | Maximum quiz attempts | Unlimited | System default |
| Time limit | Quiz completion time | None | Per-quiz setting |
| Question randomization | Shuffle question order | False | Quiz settings |

### Hard-coded Values
```typescript
// Quiz behavior settings
const QUIZ_CONFIG = {
  DEFAULT_PASSING_SCORE: 70, // Percentage
  MAX_ATTEMPTS_DEFAULT: null, // Unlimited
  QUESTION_VALIDATION: true, // Validate question structure
  AUTO_SUBMIT_TIMEOUT: 30 * 60 * 1000 // 30 minutes
};

// Question validation rules
const QUESTION_RULES = {
  MIN_OPTIONS: 2, // For select questions
  MAX_OPTIONS: 10,
  MAX_QUESTION_LENGTH: 1000,
  MAX_OPTION_LENGTH: 200
};
```

## Security Considerations

### Access Control
- **Students**: Can only view and attempt quizzes for their enrolled modules
- **Mentors**: Can view quiz results for assigned students
- **Admins/Superadmins**: Full access to quiz creation, editing, and analytics
- Quiz answers and scoring logic protected from student access

### Data Protection
- Quiz attempts are immutable once submitted
- Correct answers hidden from client-side code
- Student quiz data isolated by user permissions
- Quiz content versioning for integrity

### Failure Modes
- **Question Loading Failures**: Graceful fallback to text-only display
- **Submission Failures**: Local storage backup for answers
- **Scoring Errors**: Manual review and correction procedures
- **Time Limit Issues**: Auto-submission with partial answers

## Quiz Features

### Question Management
```typescript
// Question structure validation
const validateQuestion = (question) => {
  const required = ['id', 'text', 'order', 'answerType'];
  const hasRequiredFields = required.every(field => question[field]);
  
  // Validate answer type specific requirements
  if (['singleSelect', 'multiSelect'].includes(question.answerType)) {
    return hasRequiredFields && question.options && question.options.length >= 2;
  }
  
  return hasRequiredFields;
}
```

### Quiz Attempt Tracking
```typescript
// Quiz attempt recording
const recordQuizAttempt = async (userId, moduleId, answers) => {
  const attempt = {
    user_id: userId,
    module_id: moduleId,
    answers: answers,
    score: calculateScore(answers),
    completed_at: new Date()
  };
  
  return supabase.from('quiz_attempts').insert(attempt);
}
```

### Automatic Scoring
- Multiple choice questions automatically scored
- Text answers require manual review (future feature)
- Partial credit for multi-select questions
- Score calculation based on weighted questions

### Progress Integration
- Quiz completion triggers module completion check
- Failed quizzes block module progression
- Retake options available based on configuration
- Quiz scores factor into overall progress metrics

## Integration Points

### Module System
```typescript
// Quiz integration with module progression
const checkModuleCompletion = (userId, moduleId) => {
  // Check video completion
  // Check assignment submission
  // Check quiz passing score
  // Update module progress status
}
```

### Notification System
- Quiz completion notifications
- Score achievement alerts
- Retake reminders for failed quizzes
- Mentor notifications for student struggles

### Analytics Integration
```typescript
// Quiz performance analytics
const generateQuizAnalytics = (moduleId) => {
  return {
    completion_rate: getCompletionRate(moduleId),
    average_score: getAverageScore(moduleId),
    question_difficulty: analyzeQuestionPerformance(moduleId),
    attempt_patterns: getAttemptPatterns(moduleId)
  };
}
```

## Extending the System

### Advanced Question Types
```typescript
// Additional question formats
const advancedQuestionTypes = {
  'dragAndDrop': 'Drag and drop ordering',
  'hotspot': 'Image hotspot selection',
  'matching': 'Match terms to definitions',
  'fillInBlank': 'Complete the sentence',
  'coding': 'Code submission and evaluation'
};
```

### Adaptive Questioning
```typescript
// Personalized quiz experience
const generateAdaptiveQuiz = (userId, moduleId) => {
  // Analyze previous performance
  // Select questions based on knowledge gaps
  // Adjust difficulty based on student ability
  // Provide personalized feedback
}
```

### Advanced Analytics
1. Question effectiveness analysis
2. Learning objective mapping
3. Prerequisite knowledge tracking
4. Predictive performance modeling

### Proctoring Integration
> **Note:** Online proctoring requires third-party service integration

```typescript
// Proctoring service integration
const enableProctoring = (quizId, settings) => {
  // Webcam monitoring
  // Screen recording
  // Browser lockdown
  // Integrity verification
}
```

## Quiz Workflow Examples

### Student Taking Quiz
1. Complete module videos and assignments
2. Quiz becomes available upon module completion
3. Start quiz - questions load from database
4. Answer questions within time limit (if set)
5. Submit quiz for automatic scoring
6. View results and explanations immediately
7. Module marked complete if passing score achieved

### Admin Creating Quiz
1. Navigate to module management interface
2. Select module to add quiz questions
3. Use Question Editor to create questions
4. Set question types, options, and correct answers
5. Configure quiz settings (passing score, attempts)
6. Save quiz - becomes available to students

## Troubleshooting

### Common Issues

**Quiz Not Loading**
- Check quiz_questions table data integrity
- Verify module has associated quiz questions
- Confirm user permissions for module access
- Review question JSON structure validation

**Scoring Inconsistencies**
- Verify correct answer configuration
- Check scoring algorithm implementation
- Confirm question weight calculations
- Review partial credit rules

**Questions Not Saving**
- Validate question structure against schema
- Check database permissions for quiz_questions table
- Verify question editor form validation
- Review foreign key constraints

**Progress Not Updating**
- Check quiz completion triggers
- Verify passing score calculation
- Confirm module completion logic
- Review progress table updates

### Debugging Queries
```sql
-- Check quiz configuration for module
SELECT id, title, quiz_questions 
FROM modules 
WHERE quiz_questions IS NOT NULL 
AND jsonb_array_length(quiz_questions) > 0;

-- Review student quiz attempts
SELECT qa.*, m.title as module_title
FROM quiz_attempts qa
JOIN modules m ON qa.module_id = m.id
WHERE qa.user_id = 'student-uuid'
ORDER BY qa.attempted_at DESC;

-- Quiz performance analysis
SELECT 
  module_id,
  COUNT(*) as total_attempts,
  AVG(CASE WHEN is_correct THEN 1 ELSE 0 END) as success_rate
FROM quiz_attempts
GROUP BY module_id;
```

## Next Steps

Review [Learning Management](./learning-management.md) for module progression integration and [Reporting & Analytics](./reporting-analytics.md) for quiz performance tracking.