import React from 'react'
import { createRoot } from 'react-dom/client'
import SandboxManager from './agent'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SandboxManager />
  </React.StrictMode>
)
