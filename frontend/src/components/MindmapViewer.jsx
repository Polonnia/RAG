import React, { useState, useEffect } from 'react';
import { Tree, Card, Button, Space, Spin, Input, message, Empty, Tooltip } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import http from '../api/http';

/**
 * 思维导图展示组件
 * 用于显示文档的层级结构
 */
export default function MindMapViewer({ filename, onClose }) {
  const [mindmapData, setMindmapData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [expandedKeys, setExpandedKeys] = useState([]);
  const [autoExpandAll, setAutoExpandAll] = useState(false);

  // 监听filename变化，重置状态并加载新文件的思维导图
  useEffect(() => {
    setMindmapData(null);
    setSearchKeyword('');
    setExpandedKeys([]);
    setAutoExpandAll(false);
  }, [filename]);

  // 加载思维导图数据
  const loadMindmap = async (forceRegenerate = false) => {
    setLoading(true);
    try {
      const endpoint = forceRegenerate ? '/mindmap/regenerate' : '/mindmap/generate';
      const formData = new FormData();
      formData.append('filename', filename);

      const response = await http.post(endpoint, formData);

      if (response.data.status === 'success') {
        setMindmapData(response.data.mindmap);
        // 自动展开所有节点
        const allKeys = getAllNodeKeys(response.data.mindmap);
        setExpandedKeys(allKeys);
        setAutoExpandAll(true);
        message.success(forceRegenerate ? '思维导图已重新生成' : '思维导图加载成功');
      } else {
        message.error(response.data.error || '加载失败');
      }
    } catch (err) {
      console.error('加载思维导图失败:', err);
      message.error(
        err.response?.data?.error || err.message || '加载思维导图失败，请检查文件格式'
      );
    } finally {
      setLoading(false);
    }
  };

  // 获取所有节点的key
  const getAllNodeKeys = (node) => {
    const keys = [node.id];
    if (node.children && node.children.length > 0) {
      node.children.forEach((child) => {
        keys.push(...getAllNodeKeys(child));
      });
    }
    return keys;
  };

  // 搜索思维导图中的关键词
  const handleSearch = async () => {
    if (!searchKeyword.trim()) {
      message.warning('请输入搜索关键词');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('filename', filename);
      formData.append('keyword', searchKeyword);

      const response = await http.post('/mindmap/search', formData);

      if (response.data.status === 'success') {
        const results = response.data.results;
        message.info(`找到 ${results.length} 个匹配项`);

        // 展开搜索结果所在的节点
        const keysToExpand = new Set(expandedKeys);
        results.forEach((result) => {
          keysToExpand.add(result.id);
        });
        setExpandedKeys(Array.from(keysToExpand));
      } else {
        message.error(response.data.error || '搜索失败');
      }
    } catch (err) {
      console.error('搜索失败:', err);
      message.error('搜索失败，请重试');
    }
  };

  // 切换全部展开/折叠
  const handleToggleExpandAll = () => {
    if (autoExpandAll) {
      setExpandedKeys([]);
      setAutoExpandAll(false);
    } else {
      const allKeys = getAllNodeKeys(mindmapData);
      setExpandedKeys(allKeys);
      setAutoExpandAll(true);
    }
  };

  // 点击初始加载
  const handleInitialLoad = () => {
    if (!mindmapData) {
      loadMindmap(false);
    }
  };

  // 转换思维导图数据为Ant Design Tree格式
  const convertToTreeData = (node) => {
    const title = (
      <div className="mindmap-node-title">
        <span style={{ fontWeight: node.children ? 600 : 400 }}>
          {node.name}
        </span>
        {node.data?.pageRange && (
          <span
            style={{
              marginLeft: '8px',
              fontSize: '12px',
              color: '#999',
              fontWeight: 'normal',
            }}
          >
            {node.data.pageRange}
          </span>
        )}
      </div>
    );

    const treeNode = {
      title: node.data?.summary ? (
        <Tooltip 
          title={node.data.summary} 
          placement="topLeft"
          overlayStyle={{
            maxWidth: '80vw'
          }}
        >
          {title}
        </Tooltip>
      ) : (
        title
      ),
      key: node.id,
      children:
        node.children && node.children.length > 0
          ? node.children.map((child) => convertToTreeData(child))
          : undefined,
    };

    return treeNode;
  };

  // 如果还没有加载，显示加载提示
  if (!mindmapData && !loading) {
    return (
      <Card
        title={`思维导图 - ${filename}`}
        extra={
          <Button type="primary" onClick={handleInitialLoad}>
            加载思维导图
          </Button>
        }
        style={{ height: '100%' }}
      >
        <Empty
          description="点击上方按钮加载思维导图"
          style={{ marginTop: '50px' }}
        />
      </Card>
    );
  }

  // 渲染思维导图
  return (
    <Card
      title={`思维导图 - ${filename}`}
      style={{ height: '100%' }}
      extra={
        <Space>
          <Input.Search
            placeholder="搜索内容..."
            style={{ width: 200 }}
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            onSearch={handleSearch}
            enterButton={<SearchOutlined />}
            size="small"
          />
          <Button
            size="small"
            onClick={handleToggleExpandAll}
            disabled={loading || !mindmapData}
          >
            {autoExpandAll ? '全部折叠' : '全部展开'}
          </Button>
          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => loadMindmap(true)}
            loading={loading}
            title="重新生成思维导图"
          >
            重新生成
          </Button>
          <Button size="small" onClick={onClose}>
            关闭
          </Button>
        </Space>
      }
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spin size="large" />
          <div style={{ marginTop: '16px' }}>正在生成思维导图，请稍候...</div>
        </div>
      ) : mindmapData ? (
        <div
          style={{
            maxHeight: 'calc(100vh - 250px)',
            overflow: 'auto',
            paddingRight: '16px',
          }}
        >
          <Tree
            treeData={[convertToTreeData(mindmapData)]}
            expandedKeys={expandedKeys}
            onExpand={setExpandedKeys}
            defaultExpandAll={false}
            showIcon={true}
          />
        </div>
      ) : (
        <Empty description="无数据" />
      )}

      <style>{`
        .mindmap-node-title {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        
        .ant-tooltip-inner {
          background-color: #C2ECFC !important;
          color: #000 !important;
          max-width: 600px;
          padding: 12px !important;
          border-radius: 6px;
        }
        
        .ant-tooltip-arrow-content {
          background-color: #C2ECFC !important;
        }
      `}</style>
    </Card>
  );
}
