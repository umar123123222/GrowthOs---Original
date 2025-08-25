// UI Constants configuration
export const UI_CONSTANTS = {
  // Animation Durations (in milliseconds)
  ANIMATION_FAST: 200,
  ANIMATION_NORMAL: 300,
  ANIMATION_SLOW: 500,
  ANIMATION_EXTRA_SLOW: 1000,
  
  // Timeout Values
  DEFAULT_TIMEOUT: 30000, // 30 seconds
  SHORT_TIMEOUT: 5000,    // 5 seconds
  LONG_TIMEOUT: 60000,    // 60 seconds
  
  // Cache and Stale Times
  CACHE_TIME: 300000,     // 5 minutes
  STALE_TIME: 30000,      // 30 seconds
  SETTINGS_STALE_TIME: 300000, // 5 minutes for settings
  
  // Debounce Delays
  SEARCH_DEBOUNCE: 300,
  INPUT_DEBOUNCE: 500,
  RESIZE_DEBOUNCE: 150,
  
  // Notification Display Times
  NOTIFICATION_DURATION: 5000,
  SUCCESS_TOAST_DURATION: 3000,
  ERROR_TOAST_DURATION: 5000,
  
  // Pagination and Limits
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
  INFINITE_SCROLL_THRESHOLD: 2,
  
  // Progress and Scoring
  MILESTONE_THRESHOLDS: {
    BRONZE: 500,
    SILVER: 1000,
    GOLD: 1500,
    PLATINUM: 2000
  },
  
  // UI Breakpoints (matches Tailwind)
  BREAKPOINTS: {
    SM: 640,
    MD: 768,
    LG: 1024,
    XL: 1280,
    '2XL': 1536
  },
  
  // Common Sizes
  SIZES: {
    AVATAR_SM: 'h-8 w-8',
    AVATAR_MD: 'h-12 w-12',
    AVATAR_LG: 'h-16 w-16',
    BUTTON_SM: 'px-3 py-1.5 text-sm',
    BUTTON_MD: 'px-4 py-2',
    BUTTON_LG: 'px-6 py-3 text-lg',
    LOGO_SM: 'h-8 w-auto',
    LOGO_MD: 'h-12 w-auto',
    LOGO_LG: 'h-16 w-auto max-w-[240px]'
  },
  
  // Z-Index Layers
  Z_INDEX: {
    DROPDOWN: 50,
    MODAL: 100,
    TOOLTIP: 200,
    NOTIFICATION: 300
  }
} as const;

// Utility functions for UI constants
export const getAnimationClass = (speed: 'fast' | 'normal' | 'slow' | 'extra-slow') => {
  const durations = {
    fast: 'duration-200',
    normal: 'duration-300', 
    slow: 'duration-500',
    'extra-slow': 'duration-1000'
  };
  return durations[speed];
};

export const getTimeoutValue = (type: 'short' | 'default' | 'long') => {
  const timeouts = {
    short: UI_CONSTANTS.SHORT_TIMEOUT,
    default: UI_CONSTANTS.DEFAULT_TIMEOUT,
    long: UI_CONSTANTS.LONG_TIMEOUT
  };
  return timeouts[type];
};

export const getMilestoneLevel = (points: number) => {
  const { MILESTONE_THRESHOLDS } = UI_CONSTANTS;
  if (points >= MILESTONE_THRESHOLDS.PLATINUM) return 'PLATINUM';
  if (points >= MILESTONE_THRESHOLDS.GOLD) return 'GOLD';
  if (points >= MILESTONE_THRESHOLDS.SILVER) return 'SILVER';
  if (points >= MILESTONE_THRESHOLDS.BRONZE) return 'BRONZE';
  return 'BEGINNER';
};