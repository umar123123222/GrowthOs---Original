/**
 * Generates a cryptographically secure temporary password
 * Format: 12-16 characters with uppercase, lowercase, numbers, and symbols
 */
export function generateSecurePassword(): string {
  // Generate random length between 12-16 characters
  const length = 12 + Math.floor(crypto.getRandomValues(new Uint8Array(1))[0] % 5);
  
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()-_+=[]{}:;\'\"<>?,./';
  const allChars = uppercase + lowercase + numbers + symbols;
  
  // Cryptographically secure random function
  const getSecureRandomChar = (charset: string): string => {
    const randomIndex = crypto.getRandomValues(new Uint32Array(1))[0] % charset.length;
    return charset[randomIndex];
  };
  
  // Ensure at least one character from each required class
  let password = [
    getSecureRandomChar(uppercase),
    getSecureRandomChar(lowercase),
    getSecureRandomChar(numbers),
    getSecureRandomChar(symbols)
  ];
  
  // Fill the remainder with shuffled mix from full allowed set
  for (let i = password.length; i < length; i++) {
    password.push(getSecureRandomChar(allChars));
  }
  
  // Shuffle the entire result using Fisher-Yates algorithm with crypto random
  for (let i = password.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [password[i], password[j]] = [password[j], password[i]];
  }
  
  return password.join('');
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