import React from 'react';
import { Card, Row, Col, Button, Space, Avatar } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';

/**
 * 功能卡片组件 - 用于展示教学功能模块
 */
export default function FeatureCard({ 
  icon,
  title, 
  description, 
  color = '#1677ff',
  action = null,
  size = 'default',
  onClick = null
}) {
  const sizes = {
    small: {
      padding: '16px',
      titleSize: '14px',
      descSize: '12px'
    },
    default: {
      padding: '20px',
      titleSize: '16px',
      descSize: '14px'
    },
    large: {
      padding: '24px',
      titleSize: '18px',
      descSize: '15px'
    }
  };

  const sizeConfig = sizes[size];

  return (
    <Card
      hoverable
      onClick={onClick}
      style={{
        height: '100%',
        borderRadius: '14px',
        border: `1px solid #e6f0ff`,
        background: '#ffffff',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: onClick ? 'pointer' : 'default',
        overflow: 'hidden',
        position: 'relative'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
        e.currentTarget.style.transform = 'translateY(-4px)';
        if (e.currentTarget.querySelector('.feature-bg')) {
          e.currentTarget.querySelector('.feature-bg').style.transform = 'scale(1.1)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.06)';
        e.currentTarget.style.transform = 'translateY(0)';
        if (e.currentTarget.querySelector('.feature-bg')) {
          e.currentTarget.querySelector('.feature-bg').style.transform = 'scale(1)';
        }
      }}
    >
      {/* 背景装饰 */}
      <div
        className="feature-bg"
        style={{
          position: 'absolute',
          top: '-20px',
          right: '-20px',
          width: '120px',
          height: '120px',
          background: `linear-gradient(135deg, ${color}20, ${color}05)`,
          borderRadius: '50%',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      />
      
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* 图标 */}
        {icon && (
          <div style={{ marginBottom: '16px' }}>
            <Avatar
              style={{
                backgroundColor: `${color}20`,
                color: color,
                fontSize: '20px',
                width: '48px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: `2px solid ${color}40`
              }}
              icon={icon}
            />
          </div>
        )}

        {/* 标题 */}
        <h3 
          style={{
            margin: '0 0 8px 0',
            fontSize: sizeConfig.titleSize,
            fontWeight: 700,
            color: '#1a1a1a',
            letterSpacing: '0.3px'
          }}
        >
          {title}
        </h3>

        {/* 描述 */}
        <p 
          style={{
            margin: '0 0 16px 0',
            fontSize: sizeConfig.descSize,
            color: '#595959',
            lineHeight: 1.6,
            fontWeight: 500
          }}
        >
          {description}
        </p>

        {/* 操作按钮 */}
        {action && (
          <div>
            {action}
          </div>
        )}
      </div>
    </Card>
  );
}
