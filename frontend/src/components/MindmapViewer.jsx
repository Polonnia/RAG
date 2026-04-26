import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Tree, Card, Button, Space, Spin, Input, message, Empty, Tooltip, Tag } from 'antd';
import { ReloadOutlined, SearchOutlined, SendOutlined } from '@ant-design/icons';
import { Document, Page, pdfjs } from 'react-pdf';
import ReactPlayer from 'react-player';
import http from '../api/http';
import getApiUrl from '../apiConfig';

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js`;

const MEDIA_EXTENSIONS = new Set(['mp3', 'wav', 'm4a', 'aac', 'ogg', 'mp4', 'avi', 'mov', 'mkv', 'flv', 'wmv']);
const { TextArea } = Input;

const escapeRegExp = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

/**
 * 思维导图展示组件
 * 用于显示文档的层级结构
 */
export default function MindMapViewer({ filename, onClose }) {
  const [mindmapData, setMindmapData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState([]);
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
  const mediaSectionTextRef = useRef(null);
  const treeRef = useRef(null);
  const pdfViewportRef = useRef(null);
  const [pdfRenderWidth, setPdfRenderWidth] = useState(680);
  const [pdfSelectedText, setPdfSelectedText] = useState('');
  const [pdfQuestion, setPdfQuestion] = useState('');
  const [pdfAssistantLoading, setPdfAssistantLoading] = useState(false);
  const [pdfAssistantMessages, setPdfAssistantMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: '请在左侧预览区选择文本，然后输入问题，我会基于选中内容进行回答。',
      selectedText: '',
    },
  ]);
  const chatListRef = useRef(null);

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

  const isNodeInsideContainer = (node, container) => {
    if (!node || !container) return false;
    const element = node.nodeType === 3 ? node.parentElement : node;
    return !!element && container.contains(element);
  };

  const capturePdfSelection = () => {
    if (viewerType !== 'pdf' || !viewerBlobUrl || !pdfViewportRef.current) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    if (!isNodeInsideContainer(selection.anchorNode, pdfViewportRef.current)) return;
    if (!isNodeInsideContainer(selection.focusNode, pdfViewportRef.current)) return;

    const selected = selection.toString().trim();
    if (!selected) return;
    setPdfSelectedText(selected.slice(0, 6000));
  };

  const captureMediaSelection = () => {
    if (viewerType !== 'media' || !viewerBlobUrl || !mediaSectionTextRef.current) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    if (!isNodeInsideContainer(selection.anchorNode, mediaSectionTextRef.current)) return;
    if (!isNodeInsideContainer(selection.focusNode, mediaSectionTextRef.current)) return;

    const selected = selection.toString().trim();
    if (!selected) return;
    setPdfSelectedText(selected.slice(0, 6000));
  };

  const updateStreamingAssistantMessage = (updater) => {
    setPdfAssistantMessages((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i -= 1) {
        if (next[i]?.role === 'assistant' && next[i]?.streaming) {
          next[i] = updater(next[i]);
          break;
        }
      }
      return next;
    });
  };

  const askPdfAssistant = async () => {
    const questionText = String(pdfQuestion || '').trim();
    const selectedText = String(pdfSelectedText || '').trim();

    if (!questionText) {
      message.warning('请输入问题');
      return;
    }
    if (!selectedText) {
      message.warning('请先在左侧预览区选择一段文本');
      return;
    }

    setPdfAssistantLoading(true);
    setPdfQuestion('');

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: questionText,
      selectedText,
    };
    const assistantMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      streaming: true,
      selectedText,
    };
    setPdfAssistantMessages((prev) => [...prev, userMessage, assistantMessage]);

    try {
      const formData = new FormData();
      formData.append('filename', filename);
      formData.append('question', questionText);
      formData.append('selected_text', selectedText);
      formData.append('page', String(pdfPage));

      const token = localStorage.getItem('token');
      const formContextType = viewerType === 'media' ? 'media' : 'pdf';
      formData.append('context_type', formContextType);
      if (formContextType === 'media') {
        const currentLeaf = currentMediaLeafNode;
        const hint = currentLeaf?.data?.timeRange || '';
        if (hint) {
          formData.append('time_range', hint);
        }
      }

      const response = await fetch(`${getApiUrl()}/selection-qa`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      if (!response.ok || !response.body) {
        throw new Error(`问答请求失败: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let answerText = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let evt;
          try {
            evt = JSON.parse(trimmed);
          } catch {
            continue;
          }

          if (evt.type === 'token') {
            const chunk = String(evt.content || '');
            if (!chunk) continue;
            answerText += chunk;
            updateStreamingAssistantMessage((item) => ({ ...item, content: (item.content || '') + chunk }));
            continue;
          }

          if (evt.type === 'done') {
            answerText = String(evt.answer || answerText || '');
            updateStreamingAssistantMessage((item) => ({ ...item, content: answerText, streaming: false }));
            continue;
          }

          if (evt.type === 'error') {
            throw new Error(String(evt.message || '问答失败'));
          }
        }
      }

      updateStreamingAssistantMessage((item) => ({ ...item, content: item.content || answerText || '未生成回答', streaming: false }));
    } catch (error) {
      console.error('选中文本问答失败:', error);
      updateStreamingAssistantMessage((item) => ({
        ...item,
        content: `问答失败：${error?.message || '请稍后重试'}`,
        streaming: false,
      }));
      message.error('问答失败，请重试');
    } finally {
      setPdfAssistantLoading(false);
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

  const highlightToHtml = (text, keyword) => {
    const source = String(text || '');
    const kw = String(keyword || '').trim();
    if (!source || !kw) return source;
    const regex = new RegExp(escapeRegExp(kw), 'gi');
    return escapeHtml(source).replace(regex, (match) => `<mark class="keyword-highlight">${match}</mark>`);
  };

  const renderHighlightedText = (text, keyword) => {
    const source = String(text || '');
    const kw = String(keyword || '').trim();
    if (!source || !kw) return source;

    const escaped = escapeRegExp(kw);
    const regex = new RegExp(`(${escaped})`, 'ig');
    const checkRegex = new RegExp(`^${escaped}$`, 'i');
    const parts = source.split(regex);
    return parts.map((part, index) => (
      checkRegex.test(part)
        ? <mark key={`hit-${index}`} className="keyword-highlight">{part}</mark>
        : <React.Fragment key={`txt-${index}`}>{part}</React.Fragment>
    ));
  };

  const resolveNodeTimeBounds = (node) => {
    if (!node) return { start: null, end: null };

    const rawStart = Number(node.data?.startTime);
    const rawEnd = Number(node.data?.endTime);
    const startFromFields = Number.isFinite(rawStart) ? rawStart : null;
    const endFromFields = Number.isFinite(rawEnd) ? rawEnd : null;

    const parsed = parseTimeRange(node.data?.timeRange || node.data?.pageRange || '');

    return {
      start: startFromFields ?? parsed.start,
      end: endFromFields ?? parsed.end,
    };
  };

  const mediaLeafNodes = useMemo(() => {
    if (!mindmapData || previewType !== 'media') return [];

    const leaves = [];
    const walk = (node) => {
      if (!node) return;
      const children = Array.isArray(node.children) ? node.children : [];
      if (children.length === 0 && node.id !== 'root') {
        const { start, end } = resolveNodeTimeBounds(node);
        leaves.push({ ...node, __start: start, __end: end });
        return;
      }
      children.forEach(walk);
    };

    walk(mindmapData);
    return leaves.sort((a, b) => {
      const aStart = typeof a.__start === 'number' ? a.__start : Number.POSITIVE_INFINITY;
      const bStart = typeof b.__start === 'number' ? b.__start : Number.POSITIVE_INFINITY;
      return aStart - bStart;
    });
  }, [mindmapData, previewType]);

  const currentMediaLeafNode = useMemo(() => {
    if (previewType !== 'media' || mediaLeafNodes.length === 0) return null;
    const current = Number(mediaPlayedSec);
    if (Number.isNaN(current)) return null;

    for (let i = 0; i < mediaLeafNodes.length; i += 1) {
      const item = mediaLeafNodes[i];
      if (typeof item.__start !== 'number') continue;

      const next = mediaLeafNodes[i + 1];
      const nextStart = typeof next?.__start === 'number' ? next.__start : null;
      const effectiveEnd =
        typeof item.__end === 'number'
          ? item.__end
          : (typeof nextStart === 'number' ? nextStart : Number.POSITIVE_INFINITY);

      if (current >= item.__start && current < effectiveEnd) {
        return item;
      }
    }

    if (typeof mediaLeafNodes[0]?.__start === 'number' && current < mediaLeafNodes[0].__start) {
      return mediaLeafNodes[0];
    }

    return mediaLeafNodes[mediaLeafNodes.length - 1] || null;
  }, [previewType, mediaLeafNodes, mediaPlayedSec]);

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
    setPdfSelectedText('');
    setPdfQuestion('');
    setPdfAssistantLoading(false);
    setPdfAssistantMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: '请在左侧预览区选择文本，然后输入问题，我会基于选中内容进行回答。',
        selectedText: '',
      },
    ]);
    return () => {
      revokeViewerBlob();
    };
  }, [filename]);

  useEffect(() => {
    if (!chatListRef.current) return;
    chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
  }, [pdfAssistantMessages]);

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

  const getNodePathKeys = (node, targetId, currentPath = []) => {
    if (!node) return [];
    const nextPath = [...currentPath, node.id];
    if (node.id === targetId) {
      return nextPath;
    }
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        const path = getNodePathKeys(child, targetId, nextPath);
        if (path.length > 0) return path;
      }
    }
    return [];
  };

  const locateSearchResult = async (result) => {
    const targetId = result?.id;
    if (!targetId || !mindmapData) return;

    const pathKeys = getNodePathKeys(mindmapData, targetId);
    if (pathKeys.length > 0) {
      setExpandedKeys((prev) => Array.from(new Set([...prev, ...pathKeys])));
    }

    await jumpToNode(targetId);
    window.setTimeout(() => {
      treeRef.current?.scrollTo?.({ key: targetId, align: 'top', offset: -12 });
    }, 50);
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
        const results = Array.isArray(response.data.results) ? response.data.results : [];
        setSearchResults(results);
        message.info(`找到 ${results.length} 个匹配项`);

        // 展开搜索结果所在的节点
        const keysToExpand = new Set(expandedKeys);
        results.forEach((result) => {
          keysToExpand.add(result.id);
        });
        setExpandedKeys(Array.from(keysToExpand));

        if (results.length > 0) {
          await locateSearchResult(results[0]);
        }
      } else {
        setSearchResults([]);
        message.error(response.data.error || '搜索失败');
      }
    } catch (err) {
      console.error('搜索失败:', err);
      setSearchResults([]);
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

  useEffect(() => {
    if (!pdfViewportRef.current) return undefined;
    const element = pdfViewportRef.current;

    const updateWidth = () => {
      const nextWidth = Math.max(360, Math.floor(element.clientWidth - 24));
      setPdfRenderWidth((prev) => (prev === nextWidth ? prev : nextWidth));
    };

    updateWidth();

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(element);

    return () => observer.disconnect();
  }, [viewerType, viewerBlobUrl]);

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
      title={`智能分节 - ${filename}`}
      className="mindmap-viewer-card"
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
          <div style={{ marginTop: '16px' }}>正在生成结构信息，请稍候...</div>
        </div>
      ) : mindmapData ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 30%) 1fr', gap: 16, minHeight: 0, height: 'calc(85vh - 140px)' }}>
          <div style={{ border: '1px solid #e6edf8', borderRadius: 12, padding: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'linear-gradient(180deg, #ffffff 0%, #f9fbff 100%)', minHeight: 0 }}>
            <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <Tag color="blue">文档结构</Tag>
              <Tag color="geekblue">{searchResults.length} 个搜索结果</Tag>
            </div>
            {searchResults.length > 0 ? (
              <div style={{ marginBottom: 10, maxHeight: 132, overflowY: 'auto', border: '1px solid #edf2fc', borderRadius: 10, background: '#fff', padding: 6 }}>
                {searchResults.map((item, index) => {
                  const label = item?.title || item?.name || item?.id || `结果 ${index + 1}`;
                  const hint = item?.position || (item?.page ? `第${item.page}页` : '') || item?.timestamp || item?.pageRange || item?.timeRange || item?.path || '';
                  return (
                    <div
                      key={`${item?.id || 'result'}-${index}`}
                      onClick={() => locateSearchResult(item)}
                      style={{
                        padding: '6px 8px',
                        borderRadius: 8,
                        cursor: 'pointer',
                        border: selectedNodeId === item?.id ? '1px solid #91caff' : '1px solid transparent',
                        background: selectedNodeId === item?.id ? '#e6f4ff' : 'transparent',
                        marginBottom: 4,
                      }}
                    >
                      <div style={{ fontSize: 13, color: '#1f2d3d', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={label}>{index + 1}. {label}</div>
                      {hint ? <div style={{ fontSize: 12, color: '#8c8c8c' }}>{hint}</div> : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', paddingRight: 4 }}>
            <Tree
              ref={treeRef}
              treeData={[convertToTreeData(mindmapData)]}
              expandedKeys={expandedKeys}
              onExpand={setExpandedKeys}
              onSelect={handleSelectNode}
              selectedKeys={selectedNodeId ? [selectedNodeId] : []}
              defaultExpandAll={false}
              showIcon={true}
            />
            </div>
          </div>

          <div style={{ border: '1px solid #e6edf8', borderRadius: 12, padding: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'linear-gradient(180deg, #ffffff 0%, #f7fbff 100%)', minHeight: 0 }}>
            <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', paddingRight: 4 }}>
            {previewLoading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Spin size="large" />
                <div style={{ marginTop: 12 }}>正在加载预览...</div>
              </div>
            ) : !previewType ? (
              <Empty description="当前文件暂不支持预览" />
            ) : viewerType === 'pdf' && viewerBlobUrl ? (
              <div style={{ width: '100%', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 440px', gap: 12, minHeight: 0, height: '100%', paddingTop: 8, paddingBottom: 8, boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, minHeight: 0, height: '100%' }}>
                  <div style={{ border: '1px solid #edf2fc', borderRadius: 10, padding: '8px 10px', background: '#fff' }}>
                    <Space style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                      <Button size="small" disabled={pdfPage <= 1} onClick={() => setPdfPage((p) => Math.max(1, p - 1))}>上一页</Button>
                      <Tag color="geekblue" style={{ marginInlineEnd: 0 }}>{pdfPage} / {pdfTotalPages || '--'}</Tag>
                      <Button size="small" disabled={pdfTotalPages > 0 && pdfPage >= pdfTotalPages} onClick={() => setPdfPage((p) => Math.min(pdfTotalPages || p, p + 1))}>下一页</Button>
                    </Space>
                  </div>
                  <div
                    ref={pdfViewportRef}
                    onMouseUp={capturePdfSelection}
                    onPointerUp={capturePdfSelection}
                    style={{ border: '1px solid #edf2fc', borderRadius: 10, background: '#fff', flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', justifyContent: 'center', padding: 12 }}
                  >
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
                      <Page
                        pageNumber={pdfPage}
                        width={pdfRenderWidth}
                        customTextRenderer={({ str }) => highlightToHtml(str, searchKeyword)}
                      />
                    </Document>
                  </div>
                </div>

                <div className="pdf-assistant-panel">
                  <div className="pdf-assistant-header">
                    <Tag color="purple" style={{ marginInlineEnd: 0 }}>问答助手</Tag>
                    <span className="pdf-assistant-tip">基于选中文本回答</span>
                  </div>

                  <div className="pdf-selected-text-box" title={pdfSelectedText || '请在左侧PDF中拖动选择文本'}>
                    <div className="pdf-selected-text-label">当前选中文本</div>
                    <div className="pdf-selected-text-content">
                      {pdfSelectedText || '暂无'}
                    </div>
                  </div>

                  <div ref={chatListRef} className="pdf-chat-list">
                    {pdfAssistantMessages.map((item) => (
                      <div key={item.id} className={`pdf-chat-row ${item.role === 'user' ? 'user' : 'assistant'}`}>
                        <div className={`pdf-chat-bubble ${item.role === 'user' ? 'user' : 'assistant'}`}>
                          {item.content}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pdf-chat-input-wrap">
                    <TextArea
                      rows={3}
                      value={pdfQuestion}
                      onChange={(e) => setPdfQuestion(e.target.value)}
                      placeholder="输入你想问的问题，例如：这段话的核心观点是什么？"
                      onPressEnter={(e) => {
                        if (e.shiftKey) return;
                        e.preventDefault();
                        if (!pdfAssistantLoading) {
                          askPdfAssistant();
                        }
                      }}
                    />
                    <Button
                      type="primary"
                      icon={<SendOutlined />}
                      loading={pdfAssistantLoading}
                      onClick={askPdfAssistant}
                    >
                      发送
                    </Button>
                  </div>
                </div>
              </div>
            ) : viewerType === 'media' && viewerBlobUrl ? (
              <div style={{ width: '100%', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 440px', gap: 12, minHeight: 0, height: '100%', paddingTop: 8, paddingBottom: 8, boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, minHeight: 0, height: '100%' }}>
                  <div ref={mediaContainerRef} style={{ border: '1px solid #edf2fc', borderRadius: 10, background: '#fff', padding: 10 }}>
                    <ReactPlayer
                      key={`mindmap-media-${viewerBlobUrl}`}
                      ref={mediaPlayerRef}
                      src={viewerBlobUrl}
                      controls
                      playing={isMediaPlaying}
                      width="100%"
                      height="420px"
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
                  </div>

                  <div style={{ border: '1px solid #edf2fc', borderRadius: 10, background: '#fff', padding: 10, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <Tag color="geekblue" style={{ marginInlineEnd: 0, marginBottom: 8, width: 'fit-content' }}>字幕</Tag>
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
                        className="subtitle-scroll-panel"
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
                              className={`subtitle-card ${isActive ? 'active' : ''}`}
                            >
                              <div className={`subtitle-time-chip ${isActive ? 'active' : ''}`}>
                                {formatSecondsToClock(item.start_time)} - {formatSecondsToClock(item.end_time)}
                              </div>
                              <div className="subtitle-text">{renderHighlightedText(item.sentence, searchKeyword)}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div
                      ref={mediaSectionTextRef}
                      onMouseUp={captureMediaSelection}
                      onPointerUp={captureMediaSelection}
                      style={{
                        marginTop: 10,
                        border: '1px solid #dbe9ff',
                        borderRadius: 10,
                        padding: 10,
                        background: '#f8fbff',
                        minHeight: 100,
                        maxHeight: 200,
                        overflow: 'auto',
                        userSelect: 'text',
                      }}
                    >
                      <div style={{ fontSize: 12, color: '#4b6b95', marginBottom: 6, fontWeight: 600, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <span>当前小节文本</span>
                        <span style={{ color: '#7f8ea3', fontWeight: 500 }}>{currentMediaLeafNode?.data?.timeRange || '未知时间段'}</span>
                      </div>
                      <div style={{ fontSize: 13, color: '#2d3b50', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                        {renderHighlightedText(
                          currentMediaLeafNode?.data?.text || '当前时刻未匹配到结构叶子节点文本，请稍后播放或点击左侧章节定位。',
                          searchKeyword
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pdf-assistant-panel">
                  <div className="pdf-assistant-header">
                    <Tag color="purple" style={{ marginInlineEnd: 0 }}>问答助手</Tag>
                    <span className="pdf-assistant-tip">基于选中文本回答</span>
                  </div>

                  <div className="pdf-selected-text-box" title={pdfSelectedText || '请在左侧媒体区选择文本'}>
                    <div className="pdf-selected-text-label">当前选中文本</div>
                    <div className="pdf-selected-text-content">
                      {pdfSelectedText || '暂无'}
                    </div>
                  </div>

                  <div ref={chatListRef} className="pdf-chat-list">
                    {pdfAssistantMessages.map((item) => (
                      <div key={item.id} className={`pdf-chat-row ${item.role === 'user' ? 'user' : 'assistant'}`}>
                        <div className={`pdf-chat-bubble ${item.role === 'user' ? 'user' : 'assistant'}`}>
                          {item.content}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pdf-chat-input-wrap">
                    <TextArea
                      rows={3}
                      value={pdfQuestion}
                      onChange={(e) => setPdfQuestion(e.target.value)}
                      placeholder="输入你想问的问题，例如：这一段主要讲了什么？"
                      onPressEnter={(e) => {
                        if (e.shiftKey) return;
                        e.preventDefault();
                        if (!pdfAssistantLoading) {
                          askPdfAssistant();
                        }
                      }}
                    />
                    <Button
                      type="primary"
                      icon={<SendOutlined />}
                      loading={pdfAssistantLoading}
                      onClick={askPdfAssistant}
                    >
                      发送
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <Empty description="暂无预览内容" />
            )}
            </div>
          </div>
        </div>
      ) : (
        <Empty description="无数据" />
      )}

      <style>{`
        .mindmap-viewer-card .ant-card-body {
          height: calc(100% - 56px);
          overflow: hidden;
          background: radial-gradient(circle at 0% 0%, #f4f9ff 0%, #ffffff 48%);
        }

        .mindmap-viewer-card .ant-card-head {
          border-bottom: 1px solid #e8effa;
        }

        .mindmap-viewer-card .ant-card-head-title {
          font-size: 16px;
          font-weight: 700;
          color: #183153;
        }

        .mindmap-node-title {
          display: flex;
          align-items: center;
          gap: 4px;
          line-height: 1.5;
        }

        .subtitle-scroll-panel {
          max-height: 180px;
          overflow-y: auto;
          border: 1px solid #d9e7ff;
          border-radius: 10px;
          padding: 10px;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(245, 250, 255, 0.92) 100%),
            radial-gradient(circle at top right, rgba(143, 194, 255, 0.2), transparent 42%);
          backdrop-filter: blur(2px);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.75);
        }

        .subtitle-scroll-panel::-webkit-scrollbar {
          width: 8px;
        }

        .subtitle-scroll-panel::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #c6dbff 0%, #9dc2ff 100%);
          border-radius: 8px;
          border: 2px solid rgba(255, 255, 255, 0.85);
        }

        .subtitle-card {
          position: relative;
          padding: 10px 11px;
          margin-bottom: 8px;
          border-radius: 10px;
          cursor: pointer;
          border: 1px solid rgba(180, 203, 236, 0.35);
          background: linear-gradient(180deg, #ffffff 0%, #fdfefe 100%);
          transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease, background 0.22s ease;
          box-shadow: 0 2px 10px rgba(28, 67, 135, 0.06);
        }

        .subtitle-card:last-child {
          margin-bottom: 0;
        }

        .subtitle-card:hover {
          transform: translateY(-1px);
          border-color: rgba(122, 169, 242, 0.5);
          box-shadow: 0 8px 20px rgba(31, 90, 175, 0.12);
        }

        .subtitle-card.active {
          border-color: #72a7ff;
          background: linear-gradient(180deg, #eef5ff 0%, #f8fbff 100%);
          box-shadow: 0 10px 24px rgba(34, 102, 200, 0.18);
          animation: subtitlePulse 1.9s ease-in-out infinite;
        }

        .subtitle-card.active::after {
          content: '';
          position: absolute;
          left: 0;
          top: 8px;
          bottom: 8px;
          width: 3px;
          border-radius: 999px;
          background: linear-gradient(180deg, #2f88ff 0%, #69b2ff 100%);
        }

        .subtitle-time-chip {
          width: fit-content;
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.15px;
          color: #6f859f;
          background: rgba(230, 239, 252, 0.8);
          margin-bottom: 6px;
          transition: all 0.22s ease;
        }

        .subtitle-time-chip.active {
          color: #0856bf;
          background: linear-gradient(180deg, #d8e8ff 0%, #edf5ff 100%);
          box-shadow: inset 0 0 0 1px rgba(102, 160, 255, 0.35);
        }

        .subtitle-text {
          color: #1f2d3d;
          line-height: 1.62;
          font-size: 13px;
        }

        .keyword-highlight {
          background: linear-gradient(180deg, #fff3bf 0%, #ffe08a 100%);
          color: #543700;
          border-radius: 4px;
          padding: 0 2px;
          box-shadow: inset 0 -1px 0 rgba(245, 158, 11, 0.35);
        }

        @keyframes subtitlePulse {
          0% {
            box-shadow: 0 10px 24px rgba(34, 102, 200, 0.18);
          }
          50% {
            box-shadow: 0 12px 28px rgba(34, 102, 200, 0.26);
          }
          100% {
            box-shadow: 0 10px 24px rgba(34, 102, 200, 0.18);
          }
        }

        .pdf-assistant-panel {
          border: 1px solid #e8effa;
          border-radius: 12px;
          background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
          display: flex;
          flex-direction: column;
          min-height: 0;
          height: 100%;
          overflow: hidden;
        }

        .pdf-assistant-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          border-bottom: 1px solid #edf2fc;
          background: #fff;
        }

        .pdf-assistant-tip {
          font-size: 12px;
          color: #8c8c8c;
        }

        .pdf-selected-text-box {
          margin: 10px 12px;
          border: 1px solid #dbe9ff;
          border-radius: 10px;
          padding: 10px;
          background: #f8fbff;
        }

        .pdf-selected-text-label {
          font-size: 12px;
          color: #4b6b95;
          margin-bottom: 6px;
          font-weight: 600;
        }

        .pdf-selected-text-content {
          color: #2d3b50;
          font-size: 13px;
          line-height: 1.6;
          max-height: 86px;
          overflow: auto;
          white-space: pre-wrap;
        }

        .pdf-chat-list {
          flex: 1;
          min-height: 0;
          overflow: auto;
          padding: 8px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .pdf-chat-row {
          display: flex;
        }

        .pdf-chat-row.user {
          justify-content: flex-end;
        }

        .pdf-chat-row.assistant {
          justify-content: flex-start;
        }

        .pdf-chat-bubble {
          max-width: 90%;
          border-radius: 14px;
          padding: 9px 11px;
          font-size: 13px;
          line-height: 1.65;
          white-space: pre-wrap;
          word-break: break-word;
          box-shadow: 0 2px 8px rgba(16, 52, 122, 0.08);
        }

        .pdf-chat-bubble.user {
          background: linear-gradient(180deg, #1677ff 0%, #2f90ff 100%);
          color: #fff;
          border-top-right-radius: 6px;
        }

        .pdf-chat-bubble.assistant {
          background: #fff;
          color: #1f2d3d;
          border: 1px solid #e8effa;
          border-top-left-radius: 6px;
        }

        .pdf-chat-input-wrap {
          border-top: 1px solid #edf2fc;
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          background: #fff;
          margin-top: auto;
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
