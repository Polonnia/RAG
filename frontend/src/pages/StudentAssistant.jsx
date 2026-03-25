import React, { useState, useEffect } from 'react';
import { Card, Button, message } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import AppLayout from '../components/layout/AppLayout';

export default function StudentAssistant() {
  return (
    <AppLayout>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <Card title={<span style={{ fontWeight: 700, fontSize: 22 }}><RobotOutlined style={{ color: '#1677ff', marginRight: 8 }} />学习助手</span>}
              style={{ borderRadius: 18, boxShadow: '0 4px 24px #e6eaf1', minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: '#888', fontSize: 16 }}>
            学习助手功能开发中...
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}