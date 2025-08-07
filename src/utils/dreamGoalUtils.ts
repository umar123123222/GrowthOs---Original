interface QuestionAnswer {
  id: string;
  questionText: string;
  answer: string;
  order: number;
}

export function generateDreamGoalSummary(answers: QuestionAnswer[]): string {
  if (!answers || answers.length === 0) {
    return "";
  }

  // Sort answers by question order
  const sortedAnswers = answers
    .filter(answer => answer.answer && answer.answer.trim())
    .sort((a, b) => a.order - b.order);

  if (sortedAnswers.length === 0) {
    return "";
  }

  // Join answers into a coherent sentence
  const answerTexts = sortedAnswers.map(answer => answer.answer.trim());
  let summary = answerTexts.join(", ");

  // Ensure proper sentence structure
  if (summary && !summary.endsWith('.') && !summary.endsWith('!') && !summary.endsWith('?')) {
    summary += '.';
  }

  // Capitalize first letter
  if (summary) {
    summary = summary.charAt(0).toUpperCase() + summary.slice(1);
  }

  // Truncate to 200 characters with ellipsis
  if (summary.length > 200) {
    summary = summary.substring(0, 197) + '...';
  }

  return summary;
}

export function formatDreamGoalForDisplay(summary: string | null): string {
  if (!summary || summary.trim() === '') {
    return "Complete your questionnaire to set your dream goal.";
  }
  return summary;
}

export function extractFinancialGoalForDisplay(summary: string | null): string {
  if (!summary || summary.trim() === '') {
    return "Set your financial goal and reason for earning this money.";
  }
  
  // Split the comma-separated questionnaire answers
  const answers = summary.split(',').map(answer => answer.trim());
  
  // First answer is the income goal, second is the reason
  const incomeGoal = answers[0] || '';
  const reason = answers[1] || '';
  
  if (!incomeGoal) {
    return "Set your financial goal and reason for earning this money.";
  }
  
  // Format as "Goal: [amount] - Reason: [reason]"
  if (reason) {
    return `**Goal:** ${incomeGoal} **Reason:** ${reason}`;
  }
  
  // If only income goal is available
  return `**Goal:** ${incomeGoal}`;
}