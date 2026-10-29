import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { BrandingProvider } from './contexts/BrandingContext';
import './App.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrandingProvider><BrowserRouter><App /></BrowserRouter></BrandingProvider>
  </React.StrictMode>
);
