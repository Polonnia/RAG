import React from 'react';
import { Button, Layout, Space } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { logout } from '../../services/authService';

const { Header } = Layout;

export default function HeaderBar() {
  const navigate = useNavigate();
  return (
    <div
      style={{
        height: 64,
        background: '#f4f6fa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: '0 32px'
      }}
    >
      <Space>
        <Button type="primary" icon={<LogoutOutlined />} onClick={() => { logout(); navigate('/'); }} style={{ borderRadius: 20, fontWeight: 500 }}>
          退出登录
        </Button>
      </Space>
    </div>
  );
}


