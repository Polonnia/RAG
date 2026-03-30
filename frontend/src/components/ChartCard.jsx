import React from 'react';
import { Card, Empty, Spin } from 'antd';
import { BarChartOutlined } from '@ant-design/icons';

/**
 * 图表容器组件 - 用于展示 ECharts、Ant Design Charts 等图表
 */
export default function ChartCard({
  title = '图表',
  children,
  loading = false,
  empty = false,
  height = 400,
  style = {},
  action = null,
  description = ''
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
          <BarChartOutlined style={{ color: '#1677ff' }} />
          {title}
        </div>
      )}
      extra={action}
      style={{
        borderRadius: '14px',
        border: '1px solid #e6f0ff',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
        ...style
      }}
      bodyStyle={{
        padding: '20px'
      }}
    >
      {description && (
        <p style={{
          margin: '0 0 12px 0',
          fontSize: '13px',
          color: '#595959',
          fontWeight: 500
        }}>
          {description}
        </p>
      )}
      
      <Spin spinning={loading} size="large">
        <div style={{ height: height }}>
          {empty ? (
            <Empty description="暂无数据" style={{ marginTop: height / 2 - 50 }} />
          ) : (
            children
          )}
        </div>
      </Spin>
    </Card>
  );
}
