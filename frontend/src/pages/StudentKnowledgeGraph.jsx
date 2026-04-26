import React, { useEffect, useMemo, useState } from 'react';
import { Button, Empty, Select, Tree, message } from 'antd';
import { ApartmentOutlined, ReloadOutlined } from '@ant-design/icons';
import AppLayout from '../components/layout/AppLayout';
import KnowledgeGraph3D from '../components/KnowledgeGraph3D';
import http from '../api/http';

const getEntityId = (entity, index) => String(entity?.id || entity?.title || `node-${index}`);

const buildTreeData = (nodes = []) =>
  (Array.isArray(nodes) ? nodes : []).map((node, index) => {
    const key = String(node?.node_id || `section-${index}-${node?.title || 'untitled'}`);
    const children = Array.isArray(node?.nodes) ? buildTreeData(node.nodes) : [];
    return {
      key,
      title: String(node?.title || node?.node_id || '未命名章节'),
      children,
    };
  });

const buildSectionTitleMap = (treeNodes = []) => {
  const sectionMap = {};
  const walk = (nodes) => {
    for (const node of nodes || []) {
      if (!node) continue;
      sectionMap[String(node.key)] = String(node.title || node.key);
      walk(node.children || []);
    }
  };
  walk(treeNodes);
  return sectionMap;
};

const collectSectionScope = (treeNodes, selectedKey) => {
  const walk = (nodes) => {
    for (const node of nodes || []) {
      if (node.key === selectedKey) {
        const keys = new Set();
        const visit = (current) => {
          keys.add(current.key);
          (current.children || []).forEach(visit);
        };
        visit(node);
        return keys;
      }
      const nested = walk(node.children || []);
      if (nested) return nested;
    }
    return null;
  };

  return walk(treeNodes) || new Set();
};

const containsTreeKey = (treeNodes, targetKey) => {
  for (const node of treeNodes || []) {
    if (node.key === targetKey) return true;
    if (containsTreeKey(node.children || [], targetKey)) return true;
  }
  return false;
};

export default function StudentKnowledgeGraph() {
  const [fileOptions, setFileOptions] = useState([]);
  const [selectedFilename, setSelectedFilename] = useState('');
  const [entities, setEntities] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [structureTree, setStructureTree] = useState([]);
  const [selectedSectionKey, setSelectedSectionKey] = useState('');
  const [docName, setDocName] = useState('');
  const [docDescription, setDocDescription] = useState('');
  const [filesLoading, setFilesLoading] = useState(false);
  const [graphLoading, setGraphLoading] = useState(false);

  const selectOptions = useMemo(
    () => fileOptions.map((item) => ({
      value: item.filename,
      label: item.original_filename || item.filename,
      docId: item.doc_id,
    })),
    [fileOptions]
  );

  const loadFiles = async () => {
    setFilesLoading(true);
    try {
      const response = await http.get('/knowledge-graph/files');
      const files = Array.isArray(response?.data?.files) ? response.data.files : [];
      setFileOptions(files);
      setSelectedFilename((prev) => {
        if (prev && files.some((item) => item.filename === prev)) return prev;
        return files[0]?.filename || '';
      });
    } catch (error) {
      console.error('加载知识图谱文件列表失败:', error);
      message.error('加载文件列表失败');
      setFileOptions([]);
      setSelectedFilename('');
    } finally {
      setFilesLoading(false);
    }
  };

  const loadGraph = async (filename) => {
    if (!filename) {
      setEntities([]);
      setRelationships([]);
      setStructureTree([]);
      setSelectedSectionKey('');
      setDocName('');
      setDocDescription('');
      return;
    }

    setGraphLoading(true);
    try {
      const response = await http.get(`/knowledge-graph/${encodeURIComponent(filename)}`);
      const nextEntities = Array.isArray(response?.data?.entities) ? response.data.entities : [];
      const nextRelationships = Array.isArray(response?.data?.relationships) ? response.data.relationships : [];
      const nextStructure = buildTreeData(response?.data?.structure || []);

      setEntities(nextEntities);
      setRelationships(nextRelationships);
      setStructureTree(nextStructure);
      setDocName(response?.data?.doc_name || response?.data?.original_filename || filename);
      setDocDescription(response?.data?.doc_description || '');
    } catch (error) {
      console.error('加载知识图谱失败:', error);
      message.error('加载知识图谱失败');
      setEntities([]);
      setRelationships([]);
      setStructureTree([]);
      setDocName('');
      setDocDescription('');
    } finally {
      setGraphLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  useEffect(() => {
    if (selectedFilename) {
      loadGraph(selectedFilename);
    } else {
      setEntities([]);
      setRelationships([]);
      setStructureTree([]);
      setSelectedSectionKey('');
    }
  }, [selectedFilename]);

  useEffect(() => {
    if (selectedSectionKey && !containsTreeKey(structureTree, selectedSectionKey)) {
      setSelectedSectionKey('');
    }
  }, [selectedSectionKey, structureTree]);

  const visibleGraph = useMemo(() => {
    const sectionScope = selectedSectionKey ? collectSectionScope(structureTree, selectedSectionKey) : null;

    const filteredEntities = entities.filter((entity) => {
      if (!sectionScope) return true;
      const sectionValues = Array.isArray(entity?.section) ? entity.section.map((item) => String(item)) : [];
      return sectionValues.some((item) => sectionScope.has(item));
    });

    const entityIds = new Set(filteredEntities.map((entity, index) => getEntityId(entity, index)));
    const filteredRelationships = relationships.filter((relationship) => {
      const sourceId = String(relationship?.source || '');
      const targetId = String(relationship?.target || '');
      return entityIds.has(sourceId) && entityIds.has(targetId);
    });

    return {
      entities: filteredEntities,
      relationships: filteredRelationships,
    };
  }, [entities, relationships, selectedSectionKey, structureTree]);

  const sectionTitleMap = useMemo(() => buildSectionTitleMap(structureTree), [structureTree]);

  const graphControlPanel = (
    <div className="kg-control-panel">
      <div className="kg-control-header">
        <div>
          <div className="kg-eyebrow">Knowledge Graph Console</div>
          <div className="kg-title">知识图谱控制台</div>
          <div className="kg-subtitle">{docName || '请选择文件'}</div>
        </div>
        <Button className="kg-ghost-button" size="small" icon={<ReloadOutlined />} onClick={loadFiles}>
          刷新
        </Button>
      </div>

      {docDescription ? <div className="kg-doc-description">{docDescription}</div> : null}

      <div className="kg-block">
        <div className="kg-label">文件</div>
        <Select
          showSearch
          className="kg-select"
          size="medium"
          placeholder={filesLoading ? '正在加载文件...' : '请选择一个文件'}
          options={selectOptions}
          value={selectedFilename || undefined}
          onChange={(value) => setSelectedFilename(value)}
          loading={filesLoading}
          optionFilterProp="label"
          popupMatchSelectWidth={false}
          popupClassName="kg-select-dropdown"
        />
      </div>

      <div className="kg-stats-row">
        <div className="kg-stat-card">
          <div className="kg-stat-label">实体</div>
          <div className="kg-stat-value">{visibleGraph.entities.length}</div>
        </div>
        <div className="kg-stat-card">
          <div className="kg-stat-label">关系</div>
          <div className="kg-stat-value">{visibleGraph.relationships.length}</div>
        </div>
      </div>
    </div>
  );

  const graphFilterPanel = (
    <div className="kg-control-panel">
      <div className="kg-control-header">
        <div>
          <div className="kg-eyebrow">Graph Filter</div>
          <div className="kg-title">结构树筛选</div>
          <div className="kg-subtitle">按章节筛选节点与关系</div>
        </div>
        <Button className="kg-ghost-button" size="small" onClick={() => setSelectedSectionKey('')} disabled={!selectedSectionKey}>
          清除
        </Button>
      </div>

      <div className="kg-block kg-tree-block">
        <div className="kg-label" style={{ marginBottom: 0 }}>
          <ApartmentOutlined style={{ marginRight: 8 }} />章节结构
        </div>
        {structureTree.length ? (
          <div className="kg-tree-scroll">
            <Tree
              className="kg-structure-tree"
              treeData={structureTree}
              selectedKeys={selectedSectionKey ? [selectedSectionKey] : []}
              onSelect={(keys) => setSelectedSectionKey(keys[0] || '')}
              defaultExpandAll
              blockNode
            />
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前文件没有结构树" />
        )}
      </div>

      <div className="kg-stats-row">
        <div className="kg-stat-card">
          <div className="kg-stat-label">筛选后实体</div>
          <div className="kg-stat-value">{visibleGraph.entities.length}</div>
        </div>
        <div className="kg-stat-card">
          <div className="kg-stat-label">筛选后关系</div>
          <div className="kg-stat-value">{visibleGraph.relationships.length}</div>
        </div>
      </div>
    </div>
  );

  return (
    <AppLayout immersive>
      <div style={{ height: '100%', minHeight: 0, width: '100%' }}>
        <style>{`
          .kg-control-panel {
            display: flex;
            flex-direction: column;
            gap: 14px;
            padding: 16px;
            color: #d8e8fb;
            height: 100%;
            overflow: auto;
            background: radial-gradient(circle at top left, rgba(58, 130, 246, 0.18), transparent 34%),
              linear-gradient(180deg, rgba(8, 18, 34, 0.96) 0%, rgba(10, 24, 46, 0.92) 100%);
          }
          .kg-control-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
          }
          .kg-eyebrow {
            font-size: 11px;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: #7fa7da;
            margin-bottom: 4px;
          }
          .kg-title {
            font-size: 20px;
            font-weight: 700;
            color: #f3f8ff;
            margin-bottom: 4px;
          }
          .kg-subtitle {
            font-size: 12px;
            color: #8fb2dd;
          }
          .kg-doc-description {
            font-size: 12px;
            line-height: 1.7;
            color: #9db9da;
            padding: 10px 12px;
            border-radius: 12px;
            border: 1px solid rgba(116, 173, 255, 0.14);
            background: rgba(7, 15, 29, 0.5);
          }
          .kg-block {
            padding: 12px;
            border-radius: 14px;
            border: 1px solid rgba(116, 173, 255, 0.14);
            background: linear-gradient(180deg, rgba(7, 16, 31, 0.88) 0%, rgba(9, 21, 40, 0.76) 100%);
          }
          .kg-tree-block {
            flex: 1 1 auto;
            min-height: 0;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }
          .kg-tree-scroll {
            flex: 1;
            min-height: 0;
            overflow: auto;
            padding-right: 4px;
          }
          .kg-label {
            display: block;
            margin-bottom: 10px;
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #8eb2df;
          }
          .kg-select.ant-select-single .ant-select-selector,
          .kg-select .ant-select-selector {
            background: rgba(7, 15, 29, 0.88) !important;
            border-color: rgba(116, 173, 255, 0.16) !important;
            color: #eef6ff !important;
            box-shadow: none !important;
          }
          .kg-select .ant-select-selection-placeholder,
          .kg-select .ant-select-arrow {
            color: #7fa7da !important;
          }
          .kg-select .ant-select-selection-item,
          .kg-select .ant-select-selection-search-input {
            color: #eef6ff !important;
          }
          .kg-select.ant-select-single .ant-select-selector,
          .kg-select .ant-select-selector {
            min-height: 36px !important;
            height: 36px !important;
            padding-top: 2px !important;
            padding-bottom: 2px !important;
          }
          .kg-select-dropdown {
            background: #091423 !important;
            border: 1px solid rgba(116, 173, 255, 0.16);
            border-radius: 14px;
            box-shadow: 0 18px 48px rgba(0, 0, 0, 0.35);
            padding: 6px;
          }
          .kg-select-dropdown .ant-select-item {
            color: #dcecff !important;
            border-radius: 10px;
            white-space: normal;
            line-height: 1.5;
          }
          .kg-select-dropdown .ant-select-item-option-active:not(.ant-select-item-option-disabled) {
            background: rgba(58, 130, 246, 0.14) !important;
          }
          .kg-select-dropdown .ant-select-item-option-selected:not(.ant-select-item-option-disabled) {
            background: rgba(58, 130, 246, 0.22) !important;
            color: #f4f9ff !important;
          }
          .kg-ghost-button {
            color: #8db7ee !important;
            border-color: rgba(116, 173, 255, 0.18) !important;
            background: rgba(8, 18, 34, 0.72) !important;
          }
          .kg-structure-tree {
            background: transparent;
            color: #d8e8fb;
          }
          .kg-structure-tree .ant-tree {
            background: transparent;
            color: #d8e8fb;
          }
          .kg-structure-tree .ant-tree-node-content-wrapper {
            color: #cbdcf0;
            border-radius: 10px;
            padding: 2px 8px;
          }
          .kg-structure-tree .ant-tree-node-content-wrapper:hover {
            background: rgba(58, 130, 246, 0.12);
          }
          .kg-structure-tree .ant-tree-node-selected,
          .kg-structure-tree .ant-tree-node-content-wrapper.ant-tree-node-selected {
            background: linear-gradient(90deg, rgba(58, 130, 246, 0.26), rgba(40, 92, 173, 0.18)) !important;
            color: #f4f9ff !important;
          }
          .kg-structure-tree .ant-tree-switcher,
          .kg-structure-tree .ant-tree-indent-unit {
            color: #6f91bc;
          }
          .kg-stats-row {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }
          .kg-stat-card {
            padding: 10px 12px;
            border-radius: 12px;
            border: 1px solid rgba(116, 173, 255, 0.12);
            background: rgba(7, 15, 29, 0.6);
          }
          .kg-stat-label {
            font-size: 11px;
            color: #7ea2cf;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            margin-bottom: 6px;
          }
          .kg-stat-value {
            color: #f2f7ff;
            font-size: 22px;
            font-weight: 700;
          }
        `}</style>
        <KnowledgeGraph3D
          entities={visibleGraph.entities}
          relationships={visibleGraph.relationships}
          sectionTitleMap={sectionTitleMap}
          fullScreen
          sidePanelContent={graphControlPanel}
          filterPanelContent={graphFilterPanel}
          loading={graphLoading}
          emptyText={
            !selectedFilename
              ? '暂无可展示的图谱文件'
              : visibleGraph.entities.length === 0
                ? '当前筛选下没有匹配的图谱数据'
                : ''
          }
        />
      </div>
    </AppLayout>
  );
}
