import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Tree, Card, Button, Space, Spin, Input, message, Empty, Tooltip, Tag } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { Document, Page, pdfjs } from 'react-pdf';
import ReactPlayer from 'react-player';
import http from '../api/http';

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js`;

const MEDIA_EXTENSIONS = new Set(['mp3', 'wav', 'm4a', 'aac', 'ogg', 'mp4', 'avi', 'mov', 'mkv', 'flv', 'wmv']);

/**
 * 思维导图展示组件
 * 用于显示文档的层级结构
 */
export default function MindMapViewer({ filename, onClose }) {
  const [mindmapData, setMindmapData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [expandedKeys, setExpandedKeys] = useState([]);
  const [autoExpandAll, setAutoExpandAll] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [viewerType, setViewerType] = useState(null);
  const [viewerBlobUrl, setViewerBlobUrl] = useState('');
  const [pdfTotalPages, setPdfTotalPages] = useState(0);
  const [pdfPage, setPdfPage] = useState(1);
  const [mediaStartSec, setMediaStartSec] = useState(null);
  const [mediaEndSec, setMediaEndSec] = useState(null);
  const [mediaContentType, setMediaContentType] = useState('');
  const [isMediaPlaying, setIsMediaPlaying] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [mediaPlayedSec, setMediaPlayedSec] = useState(0);
  const [subtitles, setSubtitles] = useState([]);
  const [subtitleLoading, setSubtitleLoading] = useState(false);
  const mediaPlayerRef = useRef(null);
  const mediaContainerRef = useRef(null);
  const subtitleContainerRef = useRef(null);
  const subtitleItemRefs = useRef({});

  const ext = (filename || '').split('.').pop()?.toLowerCase() || '';
  const isPdfFile = ext === 'pdf';
  const isMediaFile = MEDIA_EXTENSIONS.has(ext);
  const previewType = isPdfFile ? 'pdf' : (isMediaFile ? 'media' : null);

  const nodeIndex = useMemo(() => {
    const map = new Map();
    const walk = (node) => {
      if (!node) return;
      map.set(node.id, node);
      if (Array.isArray(node.children)) {
        node.children.forEach(walk);
      }
    };
    walk(mindmapData);
    return map;
  }, [mindmapData]);

  const revokeViewerBlob = () => {
    if (viewerBlobUrl) {
      window.URL.revokeObjectURL(viewerBlobUrl);
    }
  };

  const parsePageFromRange = (rangeText) => {
    if (!rangeText) return 1;
    const onePageMatch = String(rangeText).match(/第\s*(\d+)\s*页/);
    if (onePageMatch) return Number(onePageMatch[1]);
    const rangeMatch = String(rangeText).match(/第\s*(\d+)\s*-\s*(\d+)\s*页/);
    if (rangeMatch) return Number(rangeMatch[1]);
    return 1;
  };

  const parseTimeToSeconds = (timeText) => {
    if (!timeText) return null;
    const raw = String(timeText).trim();
    if (!raw) return null;
    const parts = raw.split(':').map((item) => Number(item));
    if (parts.some((n) => Number.isNaN(n))) return null;
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return null;
  };

  const parseTimeRange = (timeRangeText) => {
    if (!timeRangeText) return { start: null, end: null };
    const normalized = String(timeRangeText).replace(/[~～]/g, '-').trim();
    const [startText, endText] = normalized.split('-').map((item) => item?.trim());
    return {
      start: parseTimeToSeconds(startText),
      end: parseTimeToSeconds(endText),
    };
  };

  const formatSecondsToClock = (value) => {
    const total = Math.max(0, Number(value) || 0);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    const secondsStr = secs.toFixed(2).padStart(5, '0');
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secondsStr}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secondsStr}`;
  };

  const findActiveSubtitleIndex = (list, playedSec) => {
    if (!Array.isArray(list) || list.length === 0) return -1;
    const current = Number(playedSec);
    if (Number.isNaN(current)) return -1;

    let left = 0;
    let right = list.length - 1;
    let candidate = -1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const start = Number(list[mid].start_time || 0);
      if (start <= current) {
        candidate = mid;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    if (candidate < 0) return -1;
    const item = list[candidate];
    const start = Number(item.start_time || 0);
    const end = Number(item.end_time || start);
    if (current >= start && current <= end) return candidate;

    if (candidate + 1 < list.length) {
      const next = list[candidate + 1];
      const nextStart = Number(next.start_time || 0);
      const nextEnd = Number(next.end_time || nextStart);
      if (current >= nextStart && current <= nextEnd) return candidate + 1;
    }

    return -1;
  };

  const activeSubtitleIndex = useMemo(
    () => findActiveSubtitleIndex(subtitles, mediaPlayedSec),
    [subtitles, mediaPlayedSec]
  );

  const inferMediaMimeType = (fileName) => {
    const extension = (fileName || '').split('.').pop()?.toLowerCase();
    const mimeMap = {
      mp4: 'video/mp4',
      mov: 'video/quicktime',
      avi: 'video/x-msvideo',
      mkv: 'video/x-matroska',
      flv: 'video/x-flv',
      wmv: 'video/x-ms-wmv',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      m4a: 'audio/mp4',
      aac: 'audio/aac',
      ogg: 'audio/ogg',
    };
    return mimeMap[extension] || 'application/octet-stream';
  };

  const seekMediaToSeconds = (seconds) => {
    if (seconds === null || seconds === undefined || Number.isNaN(Number(seconds))) return;
    const target = Number(seconds);
    const trySeek = () => {
      const player = mediaPlayerRef.current;

      if (player && typeof player.seekTo === 'function') {
        player.seekTo(target, 'seconds');
        return true;
      }

      if (player?.player && typeof player.player.seekTo === 'function') {
        player.player.seekTo(target, 'seconds');
        return true;
      }

      if (player && typeof player.getInternalPlayer === 'function') {
        const internal = player.getInternalPlayer();
        if (internal && typeof internal.currentTime === 'number') {
          internal.currentTime = target;
          return true;
        }
      }

      if (player && typeof player.currentTime === 'number') {
        player.currentTime = target;
        return true;
      }

      if (player?.player && typeof player.player.currentTime === 'number') {
        player.player.currentTime = target;
        return true;
      }

      const mediaEl = mediaContainerRef.current?.querySelector?.('video, audio');
      if (mediaEl && typeof mediaEl.currentTime === 'number') {
        mediaEl.currentTime = target;
        return true;
      }

      return false;
    };

    if (!trySeek()) {
      window.setTimeout(() => {
        trySeek();
      }, 120);
    }
  };

  const getMediaCurrentTime = (mediaEl) => {
    if (mediaEl && typeof mediaEl.currentTime === 'number') {
      return mediaEl.currentTime;
    }

    const player = mediaPlayerRef.current;

    if (player && typeof player.getCurrentTime === 'function') {
      const value = player.getCurrentTime();
      if (typeof value === 'number' && !Number.isNaN(value)) return value;
    }

    if (player?.player && typeof player.player.getCurrentTime === 'function') {
      const value = player.player.getCurrentTime();
      if (typeof value === 'number' && !Number.isNaN(value)) return value;
    }

    const internal = player && typeof player.getInternalPlayer === 'function'
      ? player.getInternalPlayer()
      : null;
    if (internal && typeof internal.currentTime === 'number') {
      return internal.currentTime;
    }

    return 0;
  };

  const loadPreview = async (type, options = {}) => {
    if (!filename || !type) return;
    try {
      setPreviewLoading(true);
      if (type === 'pdf') {
        const response = await http.get(`/view-pdf/${encodeURIComponent(filename)}`, {
          responseType: 'blob',
        });
        const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
        revokeViewerBlob();
        setViewerBlobUrl(blobUrl);
        setViewerType('pdf');
        setPdfPage(options.targetPage && options.targetPage > 0 ? options.targetPage : 1);
      } else if (type === 'media') {
        const response = await http.get(`/download/${encodeURIComponent(filename)}`, {
          responseType: 'blob',
        });
        const mimeType = response.data?.type || inferMediaMimeType(filename);
        const mediaBlob = response.data?.type ? response.data : new Blob([response.data], { type: mimeType });
        const blobUrl = window.URL.createObjectURL(mediaBlob);
        revokeViewerBlob();
        setViewerBlobUrl(blobUrl);
        setViewerType('media');
        setMediaStartSec(options.startSec ?? null);
        setMediaEndSec(options.endSec ?? null);
        setMediaContentType(mediaBlob.type || mimeType || '');
        setMediaReady(false);
        setIsMediaPlaying(false);
        setMediaPlayedSec(Number(options.startSec) || 0);
      }
    } catch (err) {
      console.error('加载预览失败:', err);
      message.error(err.response?.data?.detail || err.response?.data?.error || '加载预览失败');
    } finally {
      setPreviewLoading(false);
    }
  };

  // 监听filename变化，重置状态
  useEffect(() => {
    revokeViewerBlob();
    setMindmapData(null);
    setSearchKeyword('');
    setExpandedKeys([]);
    setAutoExpandAll(false);
    setSelectedNodeId('');
    setViewerType(null);
    setViewerBlobUrl('');
    setPdfTotalPages(0);
    setPdfPage(1);
    setMediaStartSec(null);
    setMediaEndSec(null);
    setMediaContentType('');
    setMediaReady(false);
    setIsMediaPlaying(false);
    setMediaPlayedSec(0);
    setSubtitles([]);
    setSubtitleLoading(false);
    return () => {
      revokeViewerBlob();
    };
  }, [filename]);

  const loadSubtitles = async () => {
    if (!filename || previewType !== 'media') {
      setSubtitles([]);
      return;
    }

    try {
      setSubtitleLoading(true);
      const response = await http.get(`/media-subtitles/${encodeURIComponent(filename)}`);
      const nextSubtitles = Array.isArray(response.data?.subtitles) ? response.data.subtitles : [];
      setSubtitles(nextSubtitles);
    } catch (err) {
      console.error('加载字幕失败:', err);
      setSubtitles([]);
    } finally {
      setSubtitleLoading(false);
    }
  };

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

  // 打开思维导图后自动加载，无需手动点击
  useEffect(() => {
    if (filename) {
      loadMindmap(false);
    }
  }, [filename]);

  useEffect(() => {
    if (previewType === 'media') {
      loadSubtitles();
    }
  }, [filename, previewType]);

  useEffect(() => {
    if (!mindmapData || !previewType) return;
    if (viewerType || viewerBlobUrl) return;
    if (previewType === 'pdf') {
      loadPreview('pdf', { targetPage: 1 });
    } else if (previewType === 'media') {
      loadPreview('media', { startSec: 0, endSec: null });
    }
  }, [mindmapData, previewType, viewerType, viewerBlobUrl]);

  useEffect(() => {
    if (viewerType !== 'media' || !mediaReady || !mediaPlayerRef.current) return;
    if (typeof mediaStartSec === 'number') {
      seekMediaToSeconds(mediaStartSec);
      setIsMediaPlaying(true);
    }
  }, [viewerType, mediaReady, mediaStartSec]);

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

  const stopPreviewPlayback = () => {
    setIsMediaPlaying(false);
    setMediaReady(false);
    setViewerType(null);
    revokeViewerBlob();
    setViewerBlobUrl('');
  };

  const jumpToNode = async (nodeId) => {
    setSelectedNodeId(nodeId || '');
    if (!nodeId) return;

    const selectedNode = nodeIndex.get(nodeId);
    if (!selectedNode) return;

    if (previewType === 'pdf') {
      const targetPage = parsePageFromRange(selectedNode.data?.pageRange);
      if (viewerType !== 'pdf' || !viewerBlobUrl) {
        await loadPreview('pdf', { targetPage });
      } else {
        setPdfPage(targetPage);
      }
      return;
    }

    if (previewType === 'media') {
      const { start, end } = parseTimeRange(selectedNode.data?.timeRange || selectedNode.data?.pageRange);
      if (start === null && end === null) {
        message.warning('该章节没有可跳转的时间信息');
        return;
      }
      if (viewerType !== 'media' || !viewerBlobUrl) {
        await loadPreview('media', { startSec: start, endSec: end });
      } else {
        setMediaStartSec(start);
        setMediaEndSec(end);
        if (typeof start === 'number') {
          seekMediaToSeconds(start);
          setIsMediaPlaying(true);
          setMediaPlayedSec(start);
        }
      }
    }
  };

  useEffect(() => {
    if (activeSubtitleIndex < 0) return;
    const container = subtitleContainerRef.current;
    if (!container) return;
    const activeNode = subtitleItemRefs.current[activeSubtitleIndex];
    if (!activeNode) return;

    const containerRect = container.getBoundingClientRect();
    const nodeRect = activeNode.getBoundingClientRect();

    const nodeTop = nodeRect.top - containerRect.top + container.scrollTop;
    const nodeBottom = nodeTop + nodeRect.height;
    const visibleTop = container.scrollTop;
    const visibleBottom = visibleTop + container.clientHeight;

    // 仅当当前高亮字幕不在可视区时再滚动，避免无意义抖动。
    if (nodeTop < visibleTop || nodeBottom > visibleBottom) {
      const nodeCenter = nodeTop + nodeRect.height / 2;
      const desiredTop = nodeCenter - container.clientHeight / 2;
      const maxTop = Math.max(0, container.scrollHeight - container.clientHeight);
      const targetTop = Math.min(maxTop, Math.max(0, desiredTop));
      container.scrollTo({ top: targetTop, behavior: 'smooth' });
    }
  }, [activeSubtitleIndex]);

  useEffect(() => {
    if (viewerType !== 'media' || !viewerBlobUrl || subtitles.length === 0) return;

    let timerId = null;
    const mediaEl = mediaContainerRef.current?.querySelector?.('video, audio');

    const syncFromPlayer = () => {
      const next = getMediaCurrentTime(mediaEl);
      setMediaPlayedSec((prev) => (Math.abs(prev - next) < 0.01 ? prev : next));
    };

    if (mediaEl) {
      mediaEl.addEventListener('timeupdate', syncFromPlayer);
      mediaEl.addEventListener('seeking', syncFromPlayer);
      mediaEl.addEventListener('seeked', syncFromPlayer);
      syncFromPlayer();
    } else {
      // 部分浏览器/播放器实例无法直接拿到 media 元素时，使用定时轮询兜底。
      timerId = window.setInterval(syncFromPlayer, 250);
    }

    return () => {
      if (mediaEl) {
        mediaEl.removeEventListener('timeupdate', syncFromPlayer);
        mediaEl.removeEventListener('seeking', syncFromPlayer);
        mediaEl.removeEventListener('seeked', syncFromPlayer);
      }
      if (timerId) {
        window.clearInterval(timerId);
      }
    };
  }, [viewerType, viewerBlobUrl, subtitles.length]);

  const handleSelectNode = async (selectedKeys) => {
    const selectedId = selectedKeys?.[0] || '';
    await jumpToNode(selectedId);
  };

  // 转换思维导图数据为Ant Design Tree格式
  const convertToTreeData = (node) => {
    const title = (
      <div
        className="mindmap-node-title"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          jumpToNode(node.id);
        }}
        style={{ cursor: 'pointer' }}
      >
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
      selectable: true,
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
        style={{ height: '100%' }}
      >
        <Empty
          description="正在准备思维导图，请稍候..."
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
            onClick={async () => {
              await loadMindmap(true);
              if (previewType) {
                if (previewType === 'pdf') {
                  await loadPreview('pdf', { targetPage: 1 });
                } else {
                  await loadPreview('media', { startSec: 0, endSec: null });
                }
              }
            }}
            loading={loading}
            title="重新生成思维导图"
          >
            重新生成
          </Button>
          <Button
            size="small"
            onClick={() => {
              stopPreviewPlayback();
              onClose?.();
            }}
          >
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
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 40%) 1fr', gap: 16, minHeight: '70vh' }}>
          <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 12, overflow: 'auto' }}>
            <div style={{ marginBottom: 8 }}>
              <Tag color="blue">文档结构</Tag>
            </div>
            <Tree
              treeData={[convertToTreeData(mindmapData)]}
              expandedKeys={expandedKeys}
              onExpand={setExpandedKeys}
              onSelect={handleSelectNode}
              selectedKeys={selectedNodeId ? [selectedNodeId] : []}
              defaultExpandAll={false}
              showIcon={true}
            />
          </div>

          <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 12, overflow: 'auto' }}>
            <div style={{ marginBottom: 8 }}>
              <Tag color="green">内容预览</Tag>
            </div>

            {previewLoading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Spin size="large" />
                <div style={{ marginTop: 12 }}>正在加载预览...</div>
              </div>
            ) : !previewType ? (
              <Empty description="当前文件暂不支持预览" />
            ) : viewerType === 'pdf' && viewerBlobUrl ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ marginBottom: 12 }}>
                  <Space>
                    <Button size="small" disabled={pdfPage <= 1} onClick={() => setPdfPage((p) => Math.max(1, p - 1))}>上一页</Button>
                    <span>{pdfPage} / {pdfTotalPages || '--'}</span>
                    <Button size="small" disabled={pdfTotalPages > 0 && pdfPage >= pdfTotalPages} onClick={() => setPdfPage((p) => Math.min(pdfTotalPages || p, p + 1))}>下一页</Button>
                  </Space>
                </div>
                <Document
                  file={viewerBlobUrl}
                  loading={<Spin />}
                  onLoadSuccess={({ numPages }) => {
                    setPdfTotalPages(numPages || 0);
                    setPdfPage((prev) => {
                      if (!numPages) return prev;
                      return Math.min(Math.max(prev, 1), numPages);
                    });
                  }}
                >
                  <Page pageNumber={pdfPage} width={Math.min(window.innerWidth * 0.45, 850)} />
                </Document>
              </div>
            ) : viewerType === 'media' && viewerBlobUrl ? (
              <div ref={mediaContainerRef}>
                <ReactPlayer
                  key={`mindmap-media-${viewerBlobUrl}`}
                  ref={mediaPlayerRef}
                  src={viewerBlobUrl}
                  controls
                  playing={isMediaPlaying}
                  width="100%"
                  height="480px"
                  config={{
                    file: {
                      forceVideo: String(mediaContentType).startsWith('video/'),
                      forceAudio: String(mediaContentType).startsWith('audio/'),
                      attributes: { preload: 'metadata', playsInline: true },
                    },
                  }}
                  onReady={() => {
                    setMediaReady(true);
                    if (typeof mediaStartSec === 'number' && mediaPlayerRef.current) {
                      seekMediaToSeconds(mediaStartSec);
                      setIsMediaPlaying(true);
                      setMediaPlayedSec(mediaStartSec);
                    }
                  }}
                  onPlay={() => {
                    setIsMediaPlaying(true);
                  }}
                  onPause={() => {
                    setIsMediaPlaying(false);
                  }}
                  onError={(error) => {
                    console.error('媒体播放失败:', error, { filename, mediaContentType });
                    message.error(`媒体无法播放：${filename}`);
                  }}
                  onProgress={({ playedSeconds }) => {
                    if (typeof mediaEndSec === 'number' && playedSeconds >= mediaEndSec) {
                      setIsMediaPlaying(false);
                    }
                  }}
                />
                <div style={{ marginTop: 8, color: '#666' }}>
                  点击左侧章节可跳转到对应时间段。
                </div>
                <div style={{ marginTop: 12 }}>
                  <Tag color="geekblue">字幕</Tag>
                  {subtitleLoading ? (
                    <div style={{ textAlign: 'center', padding: '16px 0' }}>
                      <Spin size="small" />
                      <div style={{ marginTop: 8, color: '#999' }}>字幕加载中...</div>
                    </div>
                  ) : subtitles.length === 0 ? (
                    <div style={{ padding: '12px 0', color: '#999' }}>未找到字幕文件</div>
                  ) : (
                    <div
                      ref={subtitleContainerRef}
                      style={{
                        maxHeight: 220,
                        overflowY: 'auto',
                        border: '1px solid #f0f0f0',
                        borderRadius: 8,
                        padding: 8,
                        background: '#fafcff',
                      }}
                    >
                      {subtitles.map((item, index) => {
                        const isActive = index === activeSubtitleIndex;
                        return (
                          <div
                            key={`${index}-${item.start_time}`}
                            data-subtitle-index={index}
                            ref={(el) => {
                              if (el) {
                                subtitleItemRefs.current[index] = el;
                              } else {
                                delete subtitleItemRefs.current[index];
                              }
                            }}
                            onClick={() => {
                              seekMediaToSeconds(item.start_time);
                              setIsMediaPlaying(true);
                              setMediaPlayedSec(Number(item.start_time) || 0);
                            }}
                            style={{
                              padding: '8px 10px',
                              marginBottom: 6,
                              borderRadius: 6,
                              cursor: 'pointer',
                              border: isActive ? '1px solid #1677ff' : '1px solid transparent',
                              background: isActive ? '#e6f4ff' : '#fff',
                              transition: 'all 0.2s ease',
                            }}
                          >
                            <div style={{ fontSize: 12, color: isActive ? '#0958d9' : '#8c8c8c', marginBottom: 4 }}>
                              {formatSecondsToClock(item.start_time)} - {formatSecondsToClock(item.end_time)}
                            </div>
                            <div style={{ color: '#262626', lineHeight: 1.5 }}>{item.sentence}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <Empty description="暂无预览内容" />
            )}
          </div>
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
