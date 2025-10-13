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

  /**
   * Add a message to conversation history
   * Automatically trims to keep only last 20 messages (10 pairs)
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
          firstMessage: role
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
        totalMessages: trimmedHistory.length,
        userMessages: trimmedHistory.filter(m => m.role === 'user').length,
        aiMessages: trimmedHistory.filter(m => m.role === 'assistant').length
      });
      
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
