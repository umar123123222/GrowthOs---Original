/**
 * Generates a secure temporary password
 * Format: 8-12 characters with uppercase, lowercase, numbers, and special characters
 */
export function generateSecurePassword(): string {
  const length = Math.floor(Math.random() * 5) + 8; // 8-12 characters
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*';
  
  // Ensure at least one character from each type
  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];
  
  // Fill the rest randomly
  const allChars = uppercase + lowercase + numbers + special;
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Validates password strength
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  score: number;
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;
  
  if (password.length >= 8) score += 1;
  else feedback.push('At least 8 characters');
  
  if (/[A-Z]/.test(password)) score += 1;
  else feedback.push('At least one uppercase letter');
  
  if (/[a-z]/.test(password)) score += 1;
  else feedback.push('At least one lowercase letter');
  
  if (/\d/.test(password)) score += 1;
  else feedback.push('At least one number');
  
  if (/[!@#$%^&*]/.test(password)) score += 1;
  else feedback.push('At least one special character (!@#$%^&*)');
  
  return {
    isValid: score >= 4,
    score,
    feedback
  };
}