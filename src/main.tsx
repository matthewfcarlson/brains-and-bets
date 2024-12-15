import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { insertCoin } from "playroomkit";
// Grab bootstrap css
import 'bootstrap/dist/css/bootstrap.min.css';

const root = createRoot(document.getElementById('root')!)
insertCoin({ gameId: "Uf1hWeocJCssijhDpBWP", streamMode: true }).then(() => {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
});
