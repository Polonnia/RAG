import React, { useEffect, useMemo, useRef, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { Card, Button, Space, message, Spin, Tree, Select, InputNumber, Typography, Empty, Tag } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getTeachingMaterials, getTeachingStructure, generateTeachingScheduleStream } from '../services/teachingService';
import PageHeader from '../components/PageHeader';

const { Text, Paragraph } = Typography;

const buildTreeData = (nodes, parentKey = '') => {
  if (!Array.isArray(nodes)) return [];
  return nodes.map((node, index) => {
    const key = `${parentKey}${node.node_id || index}`;
    const children = buildTreeData(node.nodes || [], `${key}-`);
    return {
      key,
      title: node.title || '未命名章节',
      children,
    };
  });
};

const flattenTreeKeys = (nodes) => {
  const keys = [];
  const walk = (list) => {
    (list || []).forEach((node) => {
      keys.push(node.key);
      if (node.children?.length) walk(node.children);
    });
  };
  walk(nodes);
  return keys;
};

const buildSelectedOutline = (nodes, checkedKeySet, depth = 0) => {
  const lines = [];

  (nodes || []).forEach((node) => {
    const selected = checkedKeySet.has(node.key);
    if (!selected) return;

    const indent = '  '.repeat(depth);
    lines.push(`${indent}- ${node.title}`);

    if (node.children?.length) {
      lines.push(...buildSelectedOutline(node.children, checkedKeySet, depth + 1));
    }
  });

  return lines;
};

export default function TeachingSettings() {
  const [materials, setMaterials] = useState([]);
  const [materialLoading, setMaterialLoading] = useState(false);
  const [selectedFilename, setSelectedFilename] = useState('');

  const [structureLoading, setStructureLoading] = useState(false);
  const [treeData, setTreeData] = useState([]);
  const [checkedKeys, setCheckedKeys] = useState([]);
  const [halfCheckedKeys, setHalfCheckedKeys] = useState([]);
  const [expandedKeys, setExpandedKeys] = useState([]);

  const [totalHours, setTotalHours] = useState(16);
  const [totalLessons, setTotalLessons] = useState(8);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleStage, setScheduleStage] = useState('');
  const [scheduleMarkdown, setScheduleMarkdown] = useState('');
  const streamBufferRef = useRef('');
  const typingTimerRef = useRef(null);

  const selectedOutline = useMemo(() => {
    const checkedSet = new Set([...(checkedKeys || []), ...(halfCheckedKeys || [])]);
    return buildSelectedOutline(treeData, checkedSet).join('\n');
  }, [treeData, checkedKeys, halfCheckedKeys]);

  const fetchMaterials = async () => {
    setMaterialLoading(true);
    try {
      const data = await getTeachingMaterials();
      setMaterials(Array.isArray(data.materials) ? data.materials : []);
    } catch (err) {
      console.error('获取教材列表失败:', err);
      message.error('获取教材列表失败');
    }
    setMaterialLoading(false);
  };

  const loadStructure = async (filename) => {
    if (!filename) {
      setTreeData([]);
      setCheckedKeys([]);
      setHalfCheckedKeys([]);
      setScheduleMarkdown('');
      try { localStorage.removeItem('teaching_schedule_markdown'); } catch {}
      return;
    }

    setStructureLoading(true);
    try {
      const data = await getTeachingStructure(filename);
      const nextTreeData = buildTreeData(data.structure || []);
      const allKeys = flattenTreeKeys(nextTreeData);
      setTreeData(nextTreeData);
      setCheckedKeys(allKeys);
      setHalfCheckedKeys([]);
      setExpandedKeys(allKeys);
      setScheduleMarkdown('');
      try { localStorage.removeItem('teaching_schedule_markdown'); } catch {}
    } catch (err) {
      console.error('获取教材目录失败:', err);
      message.error(err?.response?.data?.detail || '获取教材目录失败');
      setTreeData([]);
      setCheckedKeys([]);
      setHalfCheckedKeys([]);
      setExpandedKeys([]);
      setScheduleMarkdown('');
      try { localStorage.removeItem('teaching_schedule_markdown'); } catch {}
    }
    setStructureLoading(false);
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) {
        window.clearInterval(typingTimerRef.current);
        typingTimerRef.current = null;
      }
    };
  }, []);

  const startTypewriter = () => {
    if (typingTimerRef.current) return;
    typingTimerRef.current = window.setInterval(() => {
      if (!streamBufferRef.current) {
        window.clearInterval(typingTimerRef.current);
        typingTimerRef.current = null;
        return;
      }
      const nextChar = streamBufferRef.current.slice(0, 1);
      streamBufferRef.current = streamBufferRef.current.slice(1);
      setScheduleMarkdown((prev) => prev + nextChar);
    }, 12);
  };

  const waitForTypingDrain = async () => {
    await new Promise((resolve) => {
      const timer = window.setInterval(() => {
        if (!streamBufferRef.current && !typingTimerRef.current) {
          window.clearInterval(timer);
          resolve();
        }
      }, 30);
    });
  };

  const handleGenerateSchedule = async () => {
    if (!selectedFilename) {
      message.warning('请先选择教材');
      return;
    }
    if (!selectedOutline.trim()) {
      message.warning('请至少保留一个章节/小节');
      return;
    }
    if (!Number.isInteger(totalHours) || totalHours <= 0) {
      message.warning('请输入有效课时（正整数）');
      return;
    }
    if (!Number.isInteger(totalLessons) || totalLessons <= 0) {
      message.warning('请输入有效课数（正整数）');
      return;
    }

    setScheduleLoading(true);
    setScheduleStage('准备生成...');
    setScheduleMarkdown('');
    streamBufferRef.current = '';
    try {
      let doneMarkdown = '';
      await generateTeachingScheduleStream({
        filename: selectedFilename,
        selected_outline: selectedOutline,
        total_hours: totalHours,
        total_lessons: totalLessons,
      }, {
        onStage: (payload) => {
          setScheduleStage(payload?.stage || '生成中...');
        },
        onToken: (token) => {
          if (!token) return;
          streamBufferRef.current += token;
          startTypewriter();
        },
        onDone: (payload) => {
          doneMarkdown = String(payload?.table_markdown || '').trim();
        },
        onError: (errMsg) => {
          throw new Error(errMsg || '流式生成失败');
        },
      });

      await waitForTypingDrain();
      if (doneMarkdown) {
        setScheduleMarkdown(doneMarkdown);
      }
      setScheduleStage('生成完成');
      message.success('教学内容安排已生成');
    } catch (err) {
      console.error('生成教学安排失败:', err);
      setScheduleStage('生成失败');
      message.error(err?.message || err?.response?.data?.detail || '生成教学安排失败');
    }
    setScheduleLoading(false);
  };

  const checkedCount = checkedKeys.length + halfCheckedKeys.length;

  return (
    <AppLayout>
      <style>{`
        .teaching-layout {
          display: grid;
          grid-template-columns: minmax(360px, 42%) 1fr;
          gap: 16px;
          align-items: stretch;
        }
        .teaching-panel-card {
          height: 72vh;
          min-height: 620px;
          border: 1px solid #e5eeff;
          background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
        }
        .teaching-toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
          min-height: 40px;
          margin: 0;
          padding: 2px 0;
        }
        .teaching-section-caption {
          color: #8c8c8c;
          font-size: 12px;
          line-height: 1.5;
          margin: 8px 0 0 0;
        }
        .teaching-select {
          border-radius: 10px;
        }
        .teaching-select .ant-select-selector {
          border-radius: 10px !important;
          border-color: #d6e4ff !important;
          transition: all 0.2s ease !important;
        }
        .teaching-select:hover .ant-select-selector {
          border-color: #69b1ff !important;
        }
        .teaching-quick-btn {
          border-radius: 999px;
          border: 1px solid #d6e4ff;
          background: #f7fbff;
          color: #1f3f75;
        }
        .teaching-toolbar-group {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .teaching-config-panel {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 8px;
          padding: 10px;
          border: 1px solid #e6eeff;
          border-radius: 12px;
          background: #fafdff;
        }
        .teaching-counter {
          min-width: 140px;
          padding: 8px 10px;
          border: 1px solid #e6eeff;
          border-radius: 10px;
          background: #fff;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .teaching-counter-label {
          font-size: 12px;
          color: #59708f;
        }
        /* 左右内容容器统一尺寸，顶端对齐 */
        .teaching-tree-box, .teaching-outline-box {
          height: calc(100% - 48px);
          max-height: unset;
          margin-top: 4px;
          overflow: auto;
          border-radius: 10px;
          border: 1px solid #f0f0f0;
        }
        .teaching-outline-box {
          padding: 12px;
          background: #fafafa;
          white-space: pre-wrap;
        }
        .teaching-tree-box {
          padding: 8px;
          background: #fcfcfd;
        }
        .teaching-tree-spin {
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .teaching-tree-spin .ant-spin-nested-loading,
        .teaching-tree-spin .ant-spin-container {
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .teaching-result-box {
          margin-bottom: 0;
          padding: 12px;
          border-radius: 10px;
          border: 1px solid #f0f0f0;
          background: #fffbe6;
          min-height: 260px;
          overflow-x: auto;
        }
        @media (max-width: 1200px) {
          .teaching-layout {
            grid-template-columns: 1fr;
          }
          .teaching-panel-card {
            height: auto;
            min-height: 420px;
          }
        }
      `}</style>

      <div className="page-content-wrap page-enter">
      <PageHeader
        title="教学内容设计"
        subtitle="选择教材目录、取消不需要章节，生成结构化教学安排"
        icon={<FileTextOutlined />}
        variant="dashboard"
      />

      <Card style={{ marginBottom: 16, borderRadius: 12 }}>
        <div className="teaching-toolbar">
          <Text strong>教材选择</Text>
          <Select
            className="teaching-select"
            style={{ width: 360 }}
            placeholder="请选择知识库教材"
            value={selectedFilename || undefined}
            loading={materialLoading}
            showSearch
            allowClear
            optionFilterProp="label"
            options={(materials || []).map((item) => ({
              label: item.filename,
              value: item.filename,
            }))}
            onChange={(value) => {
              const nextValue = value || '';
              setSelectedFilename(nextValue);
              loadStructure(nextValue);
            }}
          />
          <Button className="teaching-quick-btn" onClick={() => setSelectedFilename('')} disabled={!selectedFilename}>清空选择</Button>
          <Button onClick={fetchMaterials} loading={materialLoading}>刷新教材</Button>
          {selectedFilename ? <Tag color="blue">当前教材：{selectedFilename}</Tag> : null}
          <Tag color="processing" style={{ marginInlineStart: 2 }}>已选章节/小节：{checkedCount}</Tag>
        </div>
      </Card>

      <div className="teaching-layout">
        <Card
          className="teaching-panel-card"
          title={<Space><Tag color="blue">教材思维导图</Tag><Text type="secondary">可取消任意章节/小节</Text></Space>}
          styles={{
            body: {
              height: 'calc(72vh - 57px)',
              minHeight: 520,
              display: 'flex',
              flexDirection: 'column',
              gap: 0,
              padding: '16px'
            }
          }}
        >
          <div className="teaching-toolbar">
            <Button size="small" onClick={() => {
              const allKeys = flattenTreeKeys(treeData);
              setCheckedKeys(allKeys);
              setHalfCheckedKeys([]);
            }}>全选</Button>
            <Button size="small" onClick={() => {
              setCheckedKeys([]);
              setHalfCheckedKeys([]);
            }}>清空</Button>
            <Button size="small" onClick={() => setExpandedKeys(flattenTreeKeys(treeData))}>展开全部</Button>
            <Button size="small" onClick={() => setExpandedKeys([])}>收起全部</Button>
          </div>
          {treeData.length === 0 ? (
            <Empty description="请选择教材后加载目录" style={{marginTop:16}}/>
          ) : (
            <Spin spinning={structureLoading} className="teaching-tree-spin">
              <div className="teaching-tree-box">
                <Tree
                  checkable
                  blockNode
                  checkedKeys={checkedKeys}
                  expandedKeys={expandedKeys}
                  treeData={treeData}
                  onExpand={(keys) => setExpandedKeys(keys)}
                  onCheck={(nextChecked) => {
                    const checked = Array.isArray(nextChecked) ? nextChecked : (nextChecked?.checked || []);
                    const halfChecked = Array.isArray(nextChecked) ? [] : (nextChecked?.halfChecked || []);
                    setCheckedKeys(checked);
                    setHalfCheckedKeys(halfChecked);
                  }}
                />
              </div>
            </Spin>
          )}
        </Card>

        <Card
          className="teaching-panel-card"
          title={<Space><Tag color="green">最终大纲</Tag><Text type="secondary">用于生成课程安排</Text></Space>}
          styles={{
            body: {
              height: 'calc(72vh - 57px)',
              minHeight: 520,
              display: 'flex',
              flexDirection: 'column',
              gap: 0,
              padding: '16px'
            }
          }}
        >
          <div className="teaching-config-panel">
            <div className="teaching-toolbar-group">
              <div className="teaching-counter">
                <span className="teaching-counter-label">总课时</span>
                <InputNumber min={1} max={300} precision={0} value={totalHours} onChange={(value) => setTotalHours(Number(value) || 0)} style={{ width: '100%' }} />
              </div>
              <div className="teaching-counter">
                <span className="teaching-counter-label">总课数</span>
                <InputNumber min={1} max={100} precision={0} value={totalLessons} onChange={(value) => setTotalLessons(Number(value) || 0)} style={{ width: '100%' }} />
              </div>
            </div>

            <div className="teaching-toolbar-group">
              <Text type="secondary" style={{ fontSize: 12 }}>预设方案：</Text>
              <Button className="teaching-quick-btn" size="small" onClick={() => { setTotalHours(16); setTotalLessons(8); }}>16课时 / 8课</Button>
              <Button className="teaching-quick-btn" size="small" onClick={() => { setTotalHours(32); setTotalLessons(16); }}>32课时 / 16课</Button>
              <Button className="teaching-quick-btn" size="small" onClick={() => { setTotalHours(48); setTotalLessons(24); }}>48课时 / 24课</Button>
            </div>

            <div className="teaching-toolbar-group">
              <Button type="primary" onClick={handleGenerateSchedule} loading={scheduleLoading} disabled={!selectedFilename || checkedCount === 0}>生成教学安排表</Button>
            </div>
          </div>
          {scheduleStage ? (
            <Text className="teaching-section-caption">状态：{scheduleStage}</Text>
          ) : (
            <Text className="teaching-section-caption">提示：可在左侧取消不需要的小节。</Text>
          )}
          <Paragraph className="teaching-outline-box">
            {selectedOutline || '请在左侧勾选目录节点'}
          </Paragraph>
        </Card>
      </div>

      <Card title={<Tag color="gold">教学安排</Tag>} style={{ marginTop: 16 }}>
        <Spin spinning={false}>
          {scheduleMarkdown ? (
            <div className="teaching-result-box">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  table: ({ children }) => (
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680, background: '#fff' }}>
                      {children}
                    </table>
                  ),
                  th: ({ children }) => (
                    <th style={{ border: '1px solid #d9d9d9', background: '#fafafa', padding: '8px 10px', textAlign: 'left', whiteSpace: 'nowrap' }}>
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td style={{ border: '1px solid #f0f0f0', padding: '8px 10px', verticalAlign: 'top' }}>
                      {children}
                    </td>
                  ),
                  p: ({ children }) => <p style={{ margin: '8px 0' }}>{children}</p>,
                  br: () => <br />, // 支持 <br> 换行
                }}
                skipHtml={false} // 允许解析 HTML 标签
              >
                {scheduleMarkdown}
              </ReactMarkdown>
            </div>
          ) : (
            <Empty description="填写课时并生成后显示" />
          )}
        </Spin>
      </Card>
      </div>
    </AppLayout>
  );
}