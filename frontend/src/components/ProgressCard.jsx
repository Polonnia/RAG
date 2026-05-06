import React from 'react';
import { Card, Progress, Row, Col } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';

/**
 * 进度卡片 - 展示学习/任务进度
 */
export default function ProgressCard({
  title = '进度',
  percent = 0,
  status = 'normal', // normal | success | exception
  completed = 0,
  total = 0,
  subtitle = '',
  color = '#1677ff',
  showTarget = false,
  targetLabel = '目标进度',
  targetPercent = 100,
}) {
  const getStatus = () => {
    if (status === 'success') return 'success';
    if (status === 'exception') return 'exception';
    if (percent === 100) return 'success';
    return 'normal';
  };

  return (
    <Card
      style={{
        borderRadius: '12px',
        border: `1px solid #e6f0ff`,
        background: '#ffffff',
        transition: 'all 0.3s ease',
        height: '100%'
      }}
      bodyStyle={{
        padding: '20px'
      }}
    >
      <div>
        {/* 标题 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px'
          }}
        >
          <div>
            <h4
              style={{
                margin: '0 0 4px 0',
                fontSize: '14px',
                fontWeight: 700,
                color: '#1a1a1a'
              }}
            >
              {title}
            </h4>
            {subtitle && (
              <p
                style={{
                  margin: 0,
                  fontSize: '12px',
                  color: '#595959',
                  fontWeight: 500
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
          {percent === 100 && (
            <CheckCircleOutlined style={{ fontSize: '18px', color: '#52c41a' }} />
          )}
        </div>

        {/* 进度条 */}
        <div style={{ marginBottom: '12px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '8px',
              fontSize: '12px',
              fontWeight: 600
            }}
          >
            <span style={{ color: '#595959' }}>进度</span>
            <span style={{ color: color }}>{percent}%</span>
          </div>
          <Progress
            percent={percent}
            status={getStatus()}
            strokeColor={color}
            showInfo={false}
            style={{ marginBottom: '12px' }}
          />
        </div>

        {/* 目标进度（可选） */}
        {showTarget && (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '8px',
                fontSize: '12px',
                fontWeight: 600
              }}
            >
              <span style={{ color: '#595959' }}>{targetLabel}</span>
              <span style={{ color: '#52c41a' }}>{targetPercent}%</span>
            </div>
            <Progress
              percent={targetPercent}
              status="success"
              strokeColor="#13a8a8"
              showInfo={false}
            />
          </div>
        )}

        {/* 统计信息 */}
        {total > 0 && (
          <div
            style={{
              display: 'flex',
              gap: '12px',
              marginTop: '12px',
              padding: '8px 0',
              borderTop: '1px solid #f0f5ff'
            }}
          >
            <div
              style={{
                flex: 1,
                textAlign: 'center',
                padding: '8px'
              }}
            >
              <p style={{ margin: 0, fontSize: '12px', color: '#595959' }}>已完成</p>
              <p
                style={{
                  margin: '4px 0 0 0',
                  fontSize: '18px',
                  fontWeight: 800,
                  color: '#52c41a'
                }}
              >
                {completed}
              </p>
            </div>
            <div
              style={{
                width: '1px',
                background: '#f0f5ff'
              }}
            />
            <div
              style={{
                flex: 1,
                textAlign: 'center',
                padding: '8px'
              }}
            >
              <p style={{ margin: 0, fontSize: '12px', color: '#595959' }}>总计</p>
              <p
                style={{
                  margin: '4px 0 0 0',
                  fontSize: '18px',
                  fontWeight: 800,
                  color: '#1677ff'
                }}
              >
                {total}
              </p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
