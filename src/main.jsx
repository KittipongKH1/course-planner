import React from 'react';
import ReactDOM from 'react-dom/client';
// ฟอนต์ติดมากับแอป (ไม่โหลดจาก Google Fonts) — ใช้งานได้แม้ไม่มีอินเทอร์เน็ตตอนนำเสนอ
import '@fontsource-variable/inter';
import '@fontsource/noto-sans-thai/400.css';
import '@fontsource/noto-sans-thai/500.css';
import '@fontsource/noto-sans-thai/600.css';
import '@fontsource/noto-sans-thai/700.css';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
