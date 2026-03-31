import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Upload, List, Tag, Spin, Space, Divider, Popconfirm, Switch, Typography, message, Modal, Progress } from 'antd';
const { Text } = Typography;
import { UploadOutlined, DeleteOutlined, EyeOutlined, DatabaseOutlined } from '@ant-design/icons';
import axios from 'axios';
import http from '../api/http';
import getApiUrl from '../apiConfig';
import AppLayout from '../components/layout/AppLayout';
import MindMapViewer from '../components/MindmapViewer';
import PageHeader from '../components/PageHeader';

export default function KnowledgeManagement() {
  const [selectedUploadFiles, setSelectedUploadFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [knowledgeFiles, setKnowledgeFiles] = useState([]);
  const [mindmapFile, setMindmapFile] = useState(null);
  const [uploadTaskId, setUploadTaskId] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStep, setUploadStep] = useState('');
  const [uploadFileStatuses, setUploadFileStatuses] = useState([]);
  const pollingRef = useRef(null);

  useEffect(() => {
    fetchKnowledgeFiles();
  }, []);

  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        window.clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, []);

  const mergeAndSortFileStatuses = (incomingStatuses, preferredOrder) => {
    const incomingMap = new Map((incomingStatuses || []).map(item => [item.filename, item]));
    const ordered = [];

    (preferredOrder || []).forEach((name) => {
      if (incomingMap.has(name)) {
        ordered.push(incomingMap.get(name));
        incomingMap.delete(name);
      }
    });

    const leftovers = Array.from(incomingMap.values()).sort((a, b) =>
      String(a.filename || '').localeCompare(String(b.filename || ''), 'zh-CN')
    );

    return [...ordered, ...leftovers];
  };

  const shallowEqualStatuses = (a, b) => {
    if (a === b) return true;
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      const left = a[i] || {};
      const right = b[i] || {};
      if (
        left.filename !== right.filename ||
        left.status !== right.status ||
        left.step !== right.step ||
        Number(left.progress ?? left.file_progress ?? 0) !== Number(right.progress ?? right.file_progress ?? 0) ||
        left.message !== right.message
      ) {
        return false;
      }
    }
    return true;
  };

  const fetchKnowledgeFiles = async () => {
    setFileLoading(true);
    try {
      const response = await http.get('/knowledge-files');
      setKnowledgeFiles(response.data.files);
    } catch (err) {
      console.error('获取文件列表失败:', err);
      message.error('获取知识库文件列表失败');
    }
    setFileLoading(false);
  };

  const handleUpload = async () => {
    if (selectedUploadFiles.length === 0) {
      message.warning('请先选择文件');
      return;
    }

    const validFiles = selectedUploadFiles
      .map((item) => item?.originFileObj)
      .filter((file) => file instanceof File);
    if (validFiles.length === 0) {
      message.error('未检测到可上传的文件，请重新选择文件后再试');
      return;
    }

    const formData = new FormData();
    validFiles.forEach((file) => {
      formData.append('files', file, file.name);
    });
    setLoading(true);
    try {
      if (pollingRef.current) {
        window.clearInterval(pollingRef.current);
        pollingRef.current = null;
      }

      const response = await http.post('/upload-with-progress', formData, {
        timeout: 120000,
      });

      const taskId = response.data?.task_id;
      if (!taskId) {
        throw new Error('未获取到上传任务ID');
      }

      setUploadTaskId(taskId);
      setUploadProgress(0);
      setUploadStep('任务已创建，等待处理');
      setUploadFileStatuses([]);

      const intervalId = window.setInterval(async () => {
        try {
          const taskRes = await http.get(`/upload-task/${taskId}`);
          const task = taskRes.data || {};
          const orderedStatuses = mergeAndSortFileStatuses(task.files || [], validFiles.map(file => file.name).filter(Boolean));

          setUploadProgress((prev) => {
            const next = Number(task.overall_progress || 0);
            return prev === next ? prev : next;
          });

          setUploadStep((prev) => {
            const next = task.current_step || '处理中';
            return prev === next ? prev : next;
          });

          setUploadFileStatuses((prev) => shallowEqualStatuses(prev, orderedStatuses) ? prev : orderedStatuses);

          if (task.status === 'completed') {
            window.clearInterval(intervalId);
            pollingRef.current = null;
            setLoading(false);
            setSelectedUploadFiles([]);
            fetchKnowledgeFiles();

            const results = task.results || [];
            const successCount = results.filter(r => r.status === 'success').length;
            const errorCount = results.filter(r => r.status === 'error').length;
            if (errorCount === 0) {
              message.success(`所有文件上传并解析完成（${successCount} 个）`);
            } else if (successCount === 0) {
              message.error('所有文件处理失败');
            } else {
              message.warning(`部分文件处理完成（${successCount} 成功，${errorCount} 失败）`);
            }
          }

          if (task.status === 'failed') {
            window.clearInterval(intervalId);
            pollingRef.current = null;
            setLoading(false);
            message.error(task.error || '上传任务失败');
          }
        } catch (pollErr) {
          console.error('轮询上传进度失败:', pollErr);
          window.clearInterval(intervalId);
          pollingRef.current = null;
          setLoading(false);
          message.error('获取上传进度失败');
        }
      }, 1000);

      pollingRef.current = intervalId;
    } catch (err) {
      console.error('上传错误:', err);
      setLoading(false);
      if (err.response) {
        const detail = err.response.data?.detail;
        const detailText = Array.isArray(detail) ? JSON.stringify(detail) : (detail || '');
        message.error(`上传失败: ${err.response.data?.error || detailText || err.response.statusText}`);
      } else if (err.code === 'ECONNABORTED') {
        message.error('上传超时，请稍后重试');
      } else {
        message.error('上传失败，请检查网络连接');
      }
    }
  };

  const handleDeleteFile = async (filename) => {
    try {
      await http.delete(`/delete-file/${encodeURIComponent(filename)}`);
      message.success('文件删除成功');
      fetchKnowledgeFiles();
    } catch (err) {
      console.error('删除失败:', err);
      if (err.response) {
        message.error(`删除失败: ${err.response.data.error || err.response.statusText}`);
      } else {
        message.error('删除失败，请检查网络连接');
      }
    }
  };

  const handleViewMindmap = (file) => {
    setMindmapFile(file);
  };

  const handleCloseMindmap = () => {
    setMindmapFile(null);
  };

  const getFileTypeTag = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    const typeMap = {
      'pdf': { color: 'red', text: 'PDF' },
      'doc': { color: 'blue', text: 'Word' },
      'docx': { color: 'blue', text: 'Word' },
      'mp3': { color: 'green', text: '音频' },
      'wav': { color: 'green', text: '音频' },
      'm4a': { color: 'green', text: '音频' },
      'aac': { color: 'green', text: '音频' },
      'ogg': { color: 'green', text: '音频' },
      'mp4': { color: 'purple', text: '视频' },
      'avi': { color: 'purple', text: '视频' },
      'mov': { color: 'purple', text: '视频' },
      'mkv': { color: 'purple', text: '视频' },
      'flv': { color: 'purple', text: '视频' },
      'wmv': { color: 'purple', text: '视频' }
    };
    return typeMap[ext] || { color: 'default', text: '文件' };
  };

  const handleFileChange = ({ fileList: newFileList }) => {
    setSelectedUploadFiles(newFileList || []);
  };

  const getPerFileProgressStatus = (item) => {
    if (item?.status === 'error' || item?.status === 'failed') return 'exception';
    if (item?.status === 'success' || Number(item?.progress || 0) >= 100) return 'success';
    return 'active';
  };

  return (
    <AppLayout>
      <div className="page-content-wrap page-enter">
      <PageHeader
        title="知识库管理"
        subtitle="上传多模态教材并管理可供学生下载的资源"
        icon={<DatabaseOutlined />}
        variant="dashboard"
      />
      <Card className="page-section fade-in-up" title="上传并入库" 
            style={{ marginBottom: 24, borderRadius: 18, boxShadow: '0 4px 24px #e6eaf1' }}>
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">
            支持格式：PDF、Word文档(.doc/.docx)、音频(MP3/WAV/M4A/AAC/OGG)、视频(MP4/AVI/MOV/MKV/FLV/WMV)
          </Text>
        </div>
        <Upload
          beforeUpload={() => false}
          fileList={selectedUploadFiles}
          onChange={handleFileChange}
          multiple={true}
          accept=".pdf,.doc,.docx,.mp3,.wav,.m4a,.aac,.ogg,.mp4,.avi,.mov,.mkv,.flv,.wmv"
        >
          <Button icon={<UploadOutlined />}>选择文件</Button>
        </Upload>
        <Button type="primary" onClick={handleUpload} style={{ marginTop: 16 }} loading={loading}>
          上传并入库 ({selectedUploadFiles.length} 个文件)
        </Button>

        {uploadTaskId && (
          <div style={{ marginTop: 16, padding: 12, background: '#fafafa', borderRadius: 8 }}>
            {uploadFileStatuses.length > 0 && (
              <div style={{ marginTop: 10, maxHeight: 180, overflow: 'auto' }}>
                {uploadFileStatuses.map((item, index) => (
                  <div key={`${item.filename}-${index}`} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 28, marginBottom: 4 }}>
                      <Text style={{ maxWidth: '55%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.filename}>
                        {item.filename}
                      </Text>
                      <Text type="secondary" style={{ maxWidth: '40%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }} title={item.step || '处理中'}>
                        {item.step || '处理中'}
                      </Text>
                    </div>
                    <Progress
                      percent={Math.round(Number(item.progress || 0))}
                      size="small"
                      status={getPerFileProgressStatus(item)}
                      strokeColor={item?.status === 'error' ? '#ff4d4f' : undefined}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      <Divider />

      <Card className="page-section fade-in-up" title="知识库文件列表"
            style={{ borderRadius: 18, boxShadow: '0 4px 24px #e6eaf1' }}>
        {fileLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>加载中...</div>
          </div>
        ) : knowledgeFiles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
            暂无文件，请先上传文档
          </div>
        ) : (
          <List
            dataSource={knowledgeFiles}
            renderItem={(file) => {
              const fileType = getFileTypeTag(file.filename);
              return (
                <List.Item
                  actions={[
                    (
                      <Button
                        type="text"
                        icon={<DatabaseOutlined />}
                        onClick={() => handleViewMindmap(file)}
                        size="small"
                        style={{ marginRight: 8 }}
                        title="查看详情"
                      >
                        章节内容
                      </Button>
                    ),
                    <Switch
                      checked={file.student_can_download}
                      checkedChildren="可下载"
                      unCheckedChildren="不可下载"
                      onChange={checked => {
                        axios.post(`${getApiUrl()}/set-student-download`, new URLSearchParams({
                          filename: file.filename,
                          can_download: checked
                        })).then(() => {
                          message.success('设置成功');
                          fetchKnowledgeFiles();
                        });
                      }}
                      style={{ marginRight: 16 }}
                    />,
                    <Popconfirm
                      title="确定要删除这个文件吗？"
                      description="删除后将从知识库中移除，无法恢复"
                      onConfirm={() => handleDeleteFile(file.filename)}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        size="small"
                      >
                        删除
                      </Button>
                    </Popconfirm>
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <span>{file.filename}</span>
                        <Tag color={fileType.color}>{fileType.text}</Tag>
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size="small">
                        <Text type="secondary">上传时间: {file.upload_time}</Text>
                      </Space>
                    }
                  />
                </List.Item>
              );
            }}
          />
        )}
        <div style={{ marginTop: 16 }}>
          <Button onClick={fetchKnowledgeFiles} loading={fileLoading} icon={<EyeOutlined />}>
            刷新列表
          </Button>
          <Text style={{ marginLeft: 16, color: '#666' }}>
            共 {knowledgeFiles.length} 个文件
          </Text>
        </div>
      </Card>

      <Modal
        title={null}
        open={!!mindmapFile}
        onCancel={handleCloseMindmap}
        footer={null}
        destroyOnClose
        width="98vw"
        style={{ top: 8, maxWidth: '98vw', padding: 0 }}
        bodyStyle={{
          minHeight: '70vh',
          maxHeight: '92vh',
          height: 'auto',
          overflow: 'auto',
          padding: 0,
          background: '#fff',
        }}
        centered
      >
        {mindmapFile && (
          <div style={{ height: '85vh', minHeight: 600, overflow: 'auto', padding: 0 }}>
            <MindMapViewer
              key={mindmapFile.filename}
              filename={mindmapFile.filename}
              onClose={handleCloseMindmap}
            />
          </div>
        )}
      </Modal>
    </div>
    </AppLayout>
  );
}
