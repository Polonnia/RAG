import React from 'react';
import { Row, Col, Breadcrumb } from 'antd';
import { HomeOutlined } from '@ant-design/icons';

/**
 * 页面头部组件 - 统一的页面标题和导航
 * 用于所有主要页面
 */
export default function PageHeader({ 
  title = '页面标题', 
  subtitle = '', 
  breadcrumbs = [],
  action = null,
  icon = null,
  style = {}
}) {
  return (
    <div 
      style={{
        marginBottom: '32px',
        ...style
      }}
    >
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb
          style={{ marginBottom: '16px', fontSize: '12px' }}
          items={[
            { href: '/', title: <HomeOutlined />, },
            ...breadcrumbs
          ]}
        />
      )}
      <Row justify="space-between" align="middle" style={{ marginBottom: '20px' }}>
        <Col flex="auto">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {icon && <span style={{ fontSize: '28px', color: '#1677ff' }}>{icon}</span>}
            <div>
              <h1 
                style={{
                  margin: 0,
                  fontSize: '28px',
                  fontWeight: 800,
                  color: '#1a1a1a',
                  letterSpacing: '0.5px'
                }}
              >
                {title}
              </h1>
              {subtitle && (
                <p 
                  style={{
                    margin: '4px 0 0 0',
                    fontSize: '14px',
                    color: '#595959',
                    fontWeight: 500
                  }}
                >
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        </Col>
        {action && (
          <Col>
            {action}
          </Col>
        )}
      </Row>
      
      {/* 装饰线 */}
      <div 
        style={{
          height: '3px',
          background: 'linear-gradient(90deg, #1677ff, #5b8def)',
          borderRadius: '2px',
          width: '60px'
        }}
      />
    </div>
  );
}
