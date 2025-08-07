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
  
  // Split the summary by common separators to find financial-related content
  const parts = summary.split(/[,;.]/);
  
  // Look for financial keywords in the parts
  const financialKeywords = ['money', 'dollar', '$', 'income', 'earn', 'revenue', 'profit', 'financial', 'pay', 'fund', 'invest', 'save', 'budget'];
  
  const financialParts = parts.filter(part => 
    financialKeywords.some(keyword => 
      part.toLowerCase().includes(keyword)
    )
  );
  
  if (financialParts.length > 0) {
    let result = financialParts.join(', ').trim();
    // Ensure proper sentence structure
    if (result && !result.endsWith('.') && !result.endsWith('!') && !result.endsWith('?')) {
      result += '.';
    }
    // Capitalize first letter
    if (result) {
      result = result.charAt(0).toUpperCase() + result.slice(1);
    }
    return result;
  }
  
  // If no financial keywords found, return the original summary with a focus message
  return `Financial Goal: ${summary}`;
}