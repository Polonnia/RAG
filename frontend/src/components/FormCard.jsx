import React from 'react';
import { Form, Card } from 'antd';

/**
 * 美化的表单容器组件
 * 用于统一表单样式
 */
export default function FormCard({
  title = '表单',
  children,
  form = null,
  onFinish = null,
  onFinishFailed = null,
  layout = 'vertical',
  style = {},
  bodyStyle = {},
}) {
  return (
    <Card
      title={title && (
        <div style={{
          fontSize: '16px',
          fontWeight: 700,
          color: '#1a1a1a',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div
            style={{
              width: '4px',
              height: '20px',
              background: 'linear-gradient(180deg, #1677ff, #5b8def)',
              borderRadius: '2px'
            }}
          />
          {title}
        </div>
      )}
      style={{
        borderRadius: '14px',
        border: '1px solid #e6f0ff',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
        ...style
      }}
      bodyStyle={{
        padding: '24px',
        ...bodyStyle
      }}
    >
      <Form
        form={form}
        layout={layout}
        onFinish={onFinish}
        onFinishFailed={onFinishFailed}
        autoComplete="off"
        style={{ marginTop: title ? '-8px' : '0' }}
      >
        {children}
      </Form>
    </Card>
  );
}
