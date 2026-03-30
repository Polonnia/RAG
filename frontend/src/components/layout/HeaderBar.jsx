import React from 'react';
import { Layout } from 'antd';

const { Header } = Layout;

export default function HeaderBar() {
  return (
    <div
      style={{
        height: 64,
        background: '#f4f6fa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: '0 32px',
        borderBottom: '1px solid #e6eaf1'
      }}
    >
    </div>
  );
}


