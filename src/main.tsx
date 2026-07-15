import { createRoot } from 'react-dom/client'
import '@fontsource/heebo/400.css'
import '@fontsource/heebo/500.css'
import '@fontsource/heebo/600.css'
import '@fontsource/heebo/700.css'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById("root")!).render(<App />);
