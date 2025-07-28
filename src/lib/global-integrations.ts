import { StudentIntegrations } from './student-integrations';

// Global integration checker for navigation updates
declare global {
  interface Window {
    checkIntegrations: () => void;
  }
}

export async function initializeGlobalIntegrations(userId: string) {
  window.checkIntegrations = async () => {
    try {
      const integration = await StudentIntegrations.get(userId);
      
      // Update navigation based on integration status
      const navEvent = new CustomEvent('integrationStatusChanged', {
        detail: {
          shopifyConnected: integration?.is_shopify_connected || false,
          metaConnected: integration?.is_meta_connected || false
        }
      });
      
      window.dispatchEvent(navEvent);
    } catch (error) {
      console.error('Error checking integrations:', error);
    }
  };

  // Initial check
  await window.checkIntegrations();
}