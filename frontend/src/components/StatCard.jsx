import React from 'react';
import { Statistic, Card, Row, Col } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';

/**
 * 统计卡片组件 - 用于展示关键指标
 */
export default function StatCard({
  title = '统计指标',
  value = 0,
  prefix = '',
  suffix = '',
  trend = null, // { value: 10, type: 'up' | 'down' }
  color = '#1677ff',
  icon = null,
  onClick = null,
  loading = false,
  size = 'default'
}) {
  const sizeConfig = {
    small: { titleSize: '12px', valueSize: '20px', padding: '12px' },
    default: { titleSize: '13px', valueSize: '28px', padding: '16px' },
    large: { titleSize: '14px', valueSize: '36px', padding: '20px' }
  };

  const config = sizeConfig[size];

  return (
    <Card
      style={{
        borderRadius: '12px',
        border: `1px solid #e6f0ff`,
        background: '#ffffff',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.3s ease',
        height: '100%',
        position: 'relative',
        overflow: 'hidden'
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.06)';
          e.currentTarget.style.transform = 'translateY(0)';
        }
      }}
      bodyStyle={{ padding: config.padding }}
    >
      {/* 装饰背景 */}
      <div
        style={{
          position: 'absolute',
          top: '-40px',
          right: '-40px',
          width: '120px',
          height: '120px',
          background: `linear-gradient(135deg, ${color}15, ${color}05)`,
          borderRadius: '50%',
          pointerEvents: 'none'
        }}
      />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* 标题 */}
        <div
          style={{
            fontSize: config.titleSize,
            color: '#595959',
            fontWeight: 600,
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {icon && <span style={{ fontSize: '16px', color }}>{icon}</span>}
          {title}
        </div>

        {/* 数值容器 */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          {/* 数值 */}
          <span
            style={{
              fontSize: config.valueSize,
              fontWeight: 800,
              color: '#1a1a1a'
            }}
          >
            {prefix}
            {loading ? '-' : value}
            {suffix}
          </span>

          {/* 趋势 */}
          {trend && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                fontSize: '12px',
                fontWeight: 600,
                color: trend.type === 'up' ? '#52c41a' : '#ff4d4f',
                backgroundColor: trend.type === 'up' ? '#f6ffed' : '#fff1f0',
                padding: '4px 8px',
                borderRadius: '6px'
              }}
            >
              {trend.type === 'up' ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
              {trend.value}%
            </div>
          )}
        </div>

        {/* 底部描述 */}
        {trend?.description && (
          <div style={{ fontSize: '12px', color: '#8c8c8c', marginTop: '8px' }}>
            {trend.description}
          </div>
        )}
      </div>
    </Card>
  );
}
