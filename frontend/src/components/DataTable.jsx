import React from 'react';
import { Table, Card, Empty, Button, Space, Row, Col } from 'antd';
import { ReloadOutlined, DownloadOutlined } from '@ant-design/icons';

/**
 * 美化的数据表格组件
 * 包含加载、分页、搜索等功能
 */
export default function DataTable({
  title = '数据列表',
  columns = [],
  dataSource = [],
  loading = false,
  pagination = true,
  searchable = false,
  exportable = false,
  onRefresh = null,
  onExport = null,
  rowKey = 'id',
  size = 'default',
  bordered = false,
  style = {},
  bodyStyle = {},
  ...tableProps
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
      extra={
        (onRefresh || onExport) && (
          <Space>
            {onRefresh && (
              <Button
                type="default"
                size="middle"
                icon={<ReloadOutlined />}
                onClick={onRefresh}
                loading={loading}
                style={{
                  borderRadius: '8px',
                  border: '1px solid #d9d9d9'
                }}
              >
                刷新
              </Button>
            )}
            {onExport && (
              <Button
                type="primary"
                size="middle"
                icon={<DownloadOutlined />}
                onClick={onExport}
                style={{
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #1677ff 0%, #5b8def 100%)',
                  border: 'none'
                }}
              >
                导出
              </Button>
            )}
          </Space>
        )
      }
      style={{
        borderRadius: '14px',
        border: '1px solid #e6f0ff',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
        ...style
      }}
      bodyStyle={{
        padding: '0px',
        ...bodyStyle
      }}
    >
      <Table
        columns={columns}
        dataSource={dataSource}
        rowKey={rowKey}
        loading={loading}
        size={size}
        bordered={bordered}
        pagination={pagination === false ? false : {
          pageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          ...pagination
        }}
        style={{
          fontSize: '14px'
        }}
        locale={{
          emptyText: !loading && <Empty description="暂无数据" />
        }}
        {...tableProps}
      />
    </Card>
  );
}
