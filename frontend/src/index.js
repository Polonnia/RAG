import React from 'react';
import ReactDOM from 'react-dom/client';
import AppRoutes from './routes';
import 'antd/dist/reset.css';
import './global.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<AppRoutes />);