import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { setupGlobalErrorHandling } from './lib/error-handler'

// Setup global error handling
setupGlobalErrorHandling();

createRoot(document.getElementById("root")!).render(<App />);
