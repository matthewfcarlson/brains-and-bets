import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { insertCoin } from "playroomkit";

const root = createRoot(document.getElementById('root')!)
insertCoin({ gameId: "Uf1hWeocJCssijhDpBWP", streamMode: true }).then(() => {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
});
