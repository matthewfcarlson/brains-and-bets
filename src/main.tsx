import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { insertCoin } from "playroomkit";
// Grab bootstrap css
import 'bootstrap/dist/css/bootstrap.min.css';
import './index.css'

const root = createRoot(document.getElementById('root')!)
insertCoin({ gameId: "Uf1hWeocJCssijhDpBWP", streamMode: true, maxPlayersPerRoom: 12, reconnectGracePeriod: 10000 }).then(() => {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
});
