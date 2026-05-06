import React, { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Line, Text, Sphere } from '@react-three/drei';
import { Empty, Spin } from 'antd';

const TYPE_COLORS = {
  ORGANIZATION: '#4f93ff',
  EVENT: '#46d19a',
  PERSON: '#ff8c69',
  GEO: '#8c7bff',
  PROCESS: '#f9b44f',
  TOPIC: '#1fc1d6',
  BOOK: '#f27fc7',
  APPLICATION_PATTERN: '#95a5a6',
  unnamed: '#95a5a6',
};

const normalize = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const toNodeSize = (degree, frequency) => {
  const d = normalize(degree, 1);
  const f = normalize(frequency, 1);
  return Math.max(0.7, Math.min(2.6, 0.7 + d * 0.09 + f * 0.04));
};

const toNodeColor = (type) => TYPE_COLORS[String(type || '').toUpperCase()] || TYPE_COLORS.unnamed;

const buildGraphLayout = (entities, relationships) => {
  const safeEntities = Array.isArray(entities) ? entities : [];
  const safeRelationships = Array.isArray(relationships) ? relationships : [];

  const count = Math.max(1, safeEntities.length);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  const nodes = safeEntities.map((entity, index) => {
    const id = String(entity?.id || entity?.title || `node-${index}`);
    const title = String(entity?.title || id);
    const r = 28 + (index % 13) * 2.2;
    const phi = Math.acos(1 - (2 * (index + 0.5)) / count);
    const theta = goldenAngle * index;

    return {
      id,
      title,
      type: String(entity?.type || 'unnamed'),
      description: String(entity?.description || ''),
      level: normalize(entity?.level, 0),
      sections: Array.isArray(entity?.section) ? entity.section.map((item) => String(item)) : [],
      degree: normalize(entity?.degree, 0),
      frequency: normalize(entity?.frequency, 0),
      position: [
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi),
      ],
      size: toNodeSize(entity?.degree, entity?.frequency),
      color: toNodeColor(entity?.type),
    };
  });

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const links = safeRelationships
    .map((rel, idx) => {
      const source = nodeMap.get(String(rel?.source || ''));
      const target = nodeMap.get(String(rel?.target || ''));
      if (!source || !target) return null;
      return {
        id: String(rel?.id || `link-${idx}`),
        source,
        target,
        weight: normalize(rel?.weight, 1),
        description: String(rel?.description || ''),
      };
    })
    .filter(Boolean);

  return { nodes, links };
};

function GraphScene({ nodes, links, selectedNodeId, onSelectNode, hoveredNodeId, onHoverNode }) {
  const nodeSet = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes]);
  const visibleLinks = useMemo(
    () => links.filter((link) => nodeSet.has(link.source.id) && nodeSet.has(link.target.id)),
    [links, nodeSet]
  );

  return (
    <>
      <ambientLight intensity={0.85} />
      <directionalLight position={[50, 30, 40]} intensity={1.1} color="#ffffff" />
      <directionalLight position={[-35, -25, -30]} intensity={0.45} color="#c6e4ff" />

      {visibleLinks.map((link) => {
        const isRelatedToSelected =
          selectedNodeId && (link.source.id === selectedNodeId || link.target.id === selectedNodeId);
        const width = isRelatedToSelected ? 2.2 : 1.1;
        const opacity = isRelatedToSelected ? 0.9 : 0.35;
        return (
          <Line
            key={link.id}
            points={[link.source.position, link.target.position]}
            color={isRelatedToSelected ? '#d6ecff' : '#7f99b3'}
            lineWidth={width}
            transparent
            opacity={opacity}
          />
        );
      })}

      {nodes.map((node) => {
        const isSelected = selectedNodeId === node.id;
        const isHovered = hoveredNodeId === node.id;
        const scale = isSelected ? 1.28 : isHovered ? 1.16 : 1;
        return (
          <group key={node.id} position={node.position}>
            <Sphere
              args={[node.size, 22, 22]}
              scale={[scale, scale, scale]}
              onClick={(evt) => {
                evt.stopPropagation();
                onSelectNode(node.id);
              }}
              onPointerOver={(evt) => {
                evt.stopPropagation();
                onHoverNode(node.id);
              }}
              onPointerOut={() => onHoverNode('')}
            >
              <meshStandardMaterial
                color={node.color}
                emissive={isSelected ? '#7ab8ff' : isHovered ? '#3f5f85' : '#1b2330'}
                emissiveIntensity={isSelected ? 0.52 : isHovered ? 0.35 : 0.18}
                roughness={0.3}
                metalness={0.1}
              />
            </Sphere>

            {(isSelected || isHovered) && (
              <Text
                position={[0, node.size + 2.1, 0]}
                fontSize={1.65}
                maxWidth={18}
                color="#f7fbff"
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.06}
                outlineColor="#142030"
              >
                {node.title.length > 22 ? `${node.title.slice(0, 22)}...` : node.title}
              </Text>
            )}
          </group>
        );
      })}

      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        autoRotate={!selectedNodeId}
        autoRotateSpeed={0.35}
        minDistance={30}
        maxDistance={150}
      />
    </>
  );
}

export default function KnowledgeGraph3D({
  entities = [],
  relationships = [],
  sectionTitleMap = {},
  fullScreen = false,
  sidePanelContent = null,
  filterPanelContent = null,
  loading = false,
  emptyText = '',
}) {
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [hoveredNodeId, setHoveredNodeId] = useState('');
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [activePanel, setActivePanel] = useState('control');

  const { nodes, links } = useMemo(
    () => buildGraphLayout(entities, relationships),
    [entities, relationships]
  );

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  );

  useEffect(() => {
    if (selectedNodeId && !nodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId('');
    }
    if (hoveredNodeId && !nodes.some((node) => node.id === hoveredNodeId)) {
      setHoveredNodeId('');
    }
  }, [hoveredNodeId, nodes, selectedNodeId]);

  const rootStyle = fullScreen
    ? { position: 'relative', height: '100%', minHeight: 0 }
    : { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 310px', gap: 14, height: '100%', minHeight: 0 };

  const panelWidth = 420;
  const panelRightGap = 14;
  const tabWidth = 34;
  const hasFilterPanel = Boolean(filterPanelContent);

  const openPanel = (panelKey) => {
    if (isSidePanelOpen && activePanel === panelKey) {
      setIsSidePanelOpen(false);
      return;
    }
    setActivePanel(panelKey);
    setIsSidePanelOpen(true);
  };

  const canvasWrapStyle = {
    border: fullScreen ? 'none' : '1px solid rgba(110, 162, 255, 0.24)',
    borderRadius: fullScreen ? 0 : 14,
    overflow: 'hidden',
    background: 'radial-gradient(circle at 15% 12%, #1e314a 0%, #0f1724 46%, #0b121d 100%)',
    minHeight: 0,
    height: '100%',
  };

  const panelBaseStyle = {
    border: '1px solid rgba(104, 170, 255, 0.24)',
    borderRadius: 18,
    background: 'linear-gradient(180deg, rgba(8, 18, 34, 0.94) 0%, rgba(10, 24, 46, 0.9) 100%)',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden',
    boxShadow: '0 18px 48px rgba(0, 0, 0, 0.35)',
    backdropFilter: 'blur(14px)',
  };

  const panelShellStyle = fullScreen
    ? {
      position: 'absolute',
      right: panelRightGap,
      top: 14,
      width: panelWidth,
      maxHeight: 'calc(100% - 28px)',
      height: 'calc(100% - 28px)',
      zIndex: 6,
      transform: isSidePanelOpen
        ? 'translateX(0)'
        : `translateX(calc(100% + ${panelRightGap}px))`,
      transition: 'transform 220ms ease',
    }
    : null;

  const sidePanelStyle = fullScreen
    ? {
      ...panelBaseStyle,
      width: '100%',
      height: '100%',
      opacity: isSidePanelOpen ? 1 : 0,
      pointerEvents: isSidePanelOpen ? 'auto' : 'none',
      transition: 'opacity 220ms ease',
    }
    : panelBaseStyle;

  const isFilterActive = activePanel === 'filter' && hasFilterPanel;

  const selectedNodeSectionTitles = useMemo(() => {
    if (!selectedNode?.sections?.length) return [];
    const titles = selectedNode.sections.map((sectionId) => {
      const key = String(sectionId);
      return sectionTitleMap[key] || key;
    });
    return [...new Set(titles)];
  }, [selectedNode, sectionTitleMap]);

  const infoBody = (
    <div style={{ padding: 16, overflow: 'auto', minHeight: 0, fontSize: 13, color: '#c7d8ef', lineHeight: 1.7 }}>
      {!selectedNode ? (
        <div style={{ color: '#86a3c4' }}>点击图谱中的节点查看详情。</div>
      ) : (
        <>
          <div style={{ marginBottom: 12, fontWeight: 700, color: '#f8fbff', fontSize: 16 }}>{selectedNode.title}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 14 }}>
            <div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(111, 175, 255, 0.08)', border: '1px solid rgba(111, 175, 255, 0.12)' }}>
              <div style={{ fontSize: 11, color: '#7ea2cf', marginBottom: 4 }}>TYPE</div>
              <div style={{ color: '#e8f3ff', fontWeight: 600 }}>{selectedNode.type}</div>
            </div>
            <div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(111, 175, 255, 0.08)', border: '1px solid rgba(111, 175, 255, 0.12)' }}>
              <div style={{ fontSize: 11, color: '#7ea2cf', marginBottom: 4 }}>LEVEL</div>
              <div style={{ color: '#e8f3ff', fontWeight: 600 }}>{selectedNode.level}</div>
            </div>
          </div>
          <div style={{ marginBottom: 10 }}><strong style={{ color: '#93b7e6' }}>连接度：</strong>{selectedNode.degree}</div>
          <div style={{ marginBottom: 12 }}><strong style={{ color: '#93b7e6' }}>频次：</strong>{selectedNode.frequency}</div>
          {selectedNodeSectionTitles.length ? (
            <div style={{ marginBottom: 12 }}><strong style={{ color: '#93b7e6' }}>章节：</strong>{selectedNodeSectionTitles.join('、')}</div>
          ) : null}
          <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(6, 14, 27, 0.62)', border: '1px solid rgba(111, 175, 255, 0.12)' }}>
            <strong style={{ color: '#93b7e6' }}>描述：</strong>{selectedNode.description || '暂无描述'}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div style={rootStyle}>
      <div style={canvasWrapStyle}>
        <Canvas camera={{ position: [0, 0, 78], fov: 55 }} onPointerMissed={() => setSelectedNodeId('')}>
          <GraphScene
            nodes={nodes}
            links={links}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            hoveredNodeId={hoveredNodeId}
            onHoverNode={setHoveredNodeId}
          />
        </Canvas>
      </div>

      {fullScreen && sidePanelContent ? (
        <div style={panelShellStyle}>
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: -tabWidth,
              transform: 'translateY(-50%)',
              zIndex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <button
              type="button"
              onClick={() => openPanel('control')}
              style={{
                width: tabWidth,
                minHeight: 112,
                padding: '10px 6px',
                borderRadius: '12px 0 0 12px',
                border: '1px solid rgba(104, 170, 255, 0.24)',
                background: !isFilterActive && isSidePanelOpen
                  ? 'linear-gradient(180deg, rgba(24, 51, 86, 0.98) 0%, rgba(16, 36, 64, 0.95) 100%)'
                  : 'linear-gradient(180deg, rgba(8, 18, 34, 0.94) 0%, rgba(10, 24, 46, 0.9) 100%)',
                color: '#dbeafe',
                fontSize: 12,
                fontWeight: 700,
                writingMode: 'vertical-rl',
                textOrientation: 'mixed',
                letterSpacing: '0.12em',
                cursor: 'pointer',
                boxShadow: '0 18px 48px rgba(0, 0, 0, 0.35)',
                backdropFilter: 'blur(14px)',
              }}
            >
              文件信息
            </button>

            {hasFilterPanel ? (
              <button
                type="button"
                onClick={() => openPanel('filter')}
                style={{
                  width: tabWidth,
                  minHeight: 96,
                  padding: '10px 6px',
                  borderRadius: '12px 0 0 12px',
                  border: '1px solid rgba(104, 170, 255, 0.24)',
                  background: isFilterActive && isSidePanelOpen
                    ? 'linear-gradient(180deg, rgba(24, 51, 86, 0.98) 0%, rgba(16, 36, 64, 0.95) 100%)'
                    : 'linear-gradient(180deg, rgba(8, 18, 34, 0.94) 0%, rgba(10, 24, 46, 0.9) 100%)',
                  color: '#dbeafe',
                  fontSize: 12,
                  fontWeight: 700,
                  writingMode: 'vertical-rl',
                  textOrientation: 'mixed',
                  letterSpacing: '0.12em',
                  cursor: 'pointer',
                  boxShadow: '0 18px 48px rgba(0, 0, 0, 0.35)',
                  backdropFilter: 'blur(14px)',
                }}
              >
                章节筛选
              </button>
            ) : null}
          </div>

          <div style={sidePanelStyle}>
            {isFilterActive ? (
              <div style={{ minHeight: 0, height: '100%' }}>{filterPanelContent}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
                <div style={{ flex: '1 1 62%', minHeight: 0, overflow: 'hidden' }}>
                  {sidePanelContent}
                </div>
                <div style={{ borderTop: '1px solid rgba(116, 173, 255, 0.16)', minHeight: 0, display: 'flex', flexDirection: 'column', flex: '1 1 38%' }}>
                  <div
                    style={{
                      padding: '14px 16px',
                      borderBottom: '1px solid rgba(116, 173, 255, 0.16)',
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#dbeafe',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                    }}
                  >
                    节点信息面板
                  </div>
                  {infoBody}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {loading ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 5,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(7, 15, 26, 0.42)',
            backdropFilter: 'blur(2px)',
          }}
        >
          <Spin size="large" />
        </div>
      ) : null}

      {!loading && emptyText ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 5,
            display: 'grid',
            placeItems: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              border: '1px solid #d8e6ff',
              borderRadius: 14,
              background: 'rgba(7, 17, 31, 0.88)',
              backdropFilter: 'blur(6px)',
              padding: '16px 20px',
            }}
          >
            <Empty description={emptyText} image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
