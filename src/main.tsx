import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './styles/app.css'
import { setupGlobalErrorHandling } from './lib/error-handler'

// Immediate protection against external redirects - must be first
(function blockExternalRedirects() {
  const originalAssign = window.location.assign;
  const originalReplace = window.location.replace;
  const originalHref = Object.getOwnPropertyDescriptor(window.location, 'href') || 
    Object.getOwnPropertyDescriptor(Location.prototype, 'href');
  
  // Block location.assign
  window.location.assign = function(url: string | URL) {
    const targetUrl = typeof url === 'string' ? url : url.toString();
    if (targetUrl.includes('growthos.core47.ai') || targetUrl.includes('core47.ai')) {
      console.warn('BLOCKED: External redirect attempt to:', targetUrl);
      return;
    }
    return originalAssign.call(this, url);
  };
  
  // Block location.replace  
  window.location.replace = function(url: string | URL) {
    const targetUrl = typeof url === 'string' ? url : url.toString();
    if (targetUrl.includes('growthos.core47.ai') || targetUrl.includes('core47.ai')) {
      console.warn('BLOCKED: External redirect attempt to:', targetUrl);
      return;
    }
    return originalReplace.call(this, url);
  };
  
  // Block location.href setter
  Object.defineProperty(window.location, 'href', {
    set: function(url: string) {
      if (typeof url === 'string' && (url.includes('growthos.core47.ai') || url.includes('core47.ai'))) {
        console.warn('BLOCKED: External redirect via href to:', url);
        return;
      }
      if (originalHref && originalHref.set) {
        originalHref.set.call(this, url);
      }
    },
    get: originalHref ? originalHref.get : function() { return document.URL; },
    configurable: true
  });
  
  // Block pushState/replaceState that might trigger redirects
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function(state, title, url) {
    if (url && typeof url === 'string' && (url.includes('growthos.core47.ai') || url.includes('core47.ai'))) {
      console.warn('BLOCKED: External redirect via pushState to:', url);
      return;
    }
    return originalPushState.call(this, state, title, url);
  };
  
  history.replaceState = function(state, title, url) {
    if (url && typeof url === 'string' && (url.includes('growthos.core47.ai') || url.includes('core47.ai'))) {
      console.warn('BLOCKED: External redirect via replaceState to:', url);
      return;
    }
    return originalReplaceState.call(this, state, title, url);
  };
})();

// Setup global error handling
setupGlobalErrorHandling();

createRoot(document.getElementById("root")!).render(<App />);
