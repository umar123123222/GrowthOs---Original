import { useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ConversationData {
  date: string;
  history: ConversationMessage[];
}

/**
 * Hook to manage conversation history with daily auto-reset
 * - Stores last 10 message pairs (20 total messages) in localStorage
 * - Auto-clears history when date changes (aligns with credit reset)
 * - Provides methods to add messages and retrieve history for webhook
 * - Automatically migrates from 'unknown' user key to real user ID when available
 */
export function useConversationHistory(userId: string) {
  const storageKey = `sp_history_${userId}`;
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

  const [conversationData, setConversationData] = useLocalStorage<ConversationData>(
    storageKey,
    {
      date: today,
      history: []
    }
  );

  // Migrate from 'unknown' key to real user ID when userId becomes available
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (userId === 'unknown') return;

    const unknownKey = 'sp_history_unknown';
    const raw = window.localStorage.getItem(unknownKey);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as ConversationData;
      const currentDate = new Date().toISOString().split('T')[0];
      
      // Only migrate if it's from today
      if (parsed?.date === currentDate && parsed?.history?.length > 0) {
        window.localStorage.setItem(storageKey, raw);
        window.localStorage.removeItem(unknownKey);
        setConversationData(parsed);
        console.log('Success Partner History: Migrated unknown -> user key', {
          from: unknownKey,
          to: storageKey,
          messageCount: parsed.history.length,
          userMessages: parsed.history.filter(m => m.role === 'user').length,
          aiMessages: parsed.history.filter(m => m.role === 'assistant').length
        });
      } else {
        // If old day, just clear the unknown key
        window.localStorage.removeItem(unknownKey);
        console.log('Success Partner History: Cleared old unknown key');
      }
    } catch (error) {
      console.error('Success Partner History: Error migrating unknown key', error);
      window.localStorage.removeItem(unknownKey);
    }
  }, [userId, storageKey, setConversationData]);

  /**
   * Add a message to conversation history
   * Automatically trims to keep only last 20 messages (10 pairs)
   * Persists all messages including those from unknown users (migration handles the rest)
   */
  const addMessage = (role: 'user' | 'assistant', content: string) => {
    setConversationData(prev => {
      // Check if we need to reset for a new day
      const currentDate = new Date().toISOString().split('T')[0];
      const shouldReset = prev.date !== currentDate;
      
      const newMessage: ConversationMessage = {
        role,
        content,
        timestamp: new Date().toISOString()
      };
      
      // If date changed, start fresh with just this message
      if (shouldReset) {
        console.log('Success Partner History: Date changed, resetting history', {
          oldDate: prev.date,
          newDate: currentDate,
          firstMessage: role,
          storageKey
        });
        return {
          date: currentDate,
          history: [newMessage]
        };
      }
      
      // Otherwise append and trim
      const updatedHistory = [...prev.history, newMessage];
      const trimmedHistory = updatedHistory.slice(-20);
      
      console.log('Success Partner History: Message saved', {
        role,
        storageKey,
        totalMessages: trimmedHistory.length,
        userMessages: trimmedHistory.filter(m => m.role === 'user').length,
        aiMessages: trimmedHistory.filter(m => m.role === 'assistant').length
      });

      // Debug: verify localStorage after save
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          const saved = window.localStorage.getItem(storageKey);
          console.log('Success Partner History: Verified localStorage', {
            storageKey,
            exists: !!saved,
            length: saved ? JSON.parse(saved).history?.length : 0
          });
        }, 100);
      }
      
      return {
        date: currentDate,
        history: trimmedHistory
      };
    });
  };

  /**
   * Get current conversation history for webhook payload
   */
  const getHistory = (): ConversationMessage[] => {
    const currentDate = new Date().toISOString().split('T')[0];
    const shouldReset = conversationData.date !== currentDate;
    
    if (shouldReset) {
      return [];
    }
    return conversationData.history;
  };

  /**
   * Clear conversation history (useful for manual reset or testing)
   */
  const clearHistory = () => {
    setConversationData({
      date: today,
      history: []
    });
  };

  return {
    addMessage,
    getHistory,
    clearHistory,
    messageCount: conversationData.history.length
  };
}
