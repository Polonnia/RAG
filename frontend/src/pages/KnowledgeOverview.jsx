import React, { useEffect, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { Button, List, Upload, message, Space, Popconfirm, Spin } from 'antd';
import { UploadOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { getDocuments, upload, removeDocument } from '../services/knowledgeService';

export default function KnowledgeOverview() {
  const [files, setFiles] = useState([]);
  const [fileList, setFileList] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const res = await getDocuments();
      const list = Array.isArray(res?.files) ? res.files : [];
      const normalized = list.map(f => (typeof f === 'string' ? { filename: f } : f));
      setFiles(normalized);
    } catch (e) {
      message.error('获取知识库文件列表失败');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleUpload = async () => {
    if (fileList.length === 0) {
      message.warning('请先选择文件');
      return;
    }
    const formData = new FormData();
    fileList.forEach(f => formData.append('files', f));
    setLoading(true);
    try {
      const response = await upload(formData);
      if (response.results) {
        const results = response.results;
        results.forEach(r => {
          if (r.status === 'success') message.success(`${r.filename}: ${r.msg}`);
          else message.error(`${r.filename}: ${r.msg}`);
        });
      } else if (response.msg) {
        message.success(response.msg);
      }
      setFileList([]);
      fetchFiles();
    } catch (e) {
      message.error('上传失败，请稍后重试');
    }
    setLoading(false);
  };

  const handleDelete = async (filename) => {
    try {
      await removeDocument(filename);
      message.success('文件删除成功');
      fetchFiles();
    } catch (e) {
      message.error('删除失败');
    }
  };

  return (
    <AppLayout>
      <h2 style={{ fontWeight: 700, marginTop: 0 }}>知识库总览</h2>
      <Space style={{ marginBottom: 16 }}>
        <Upload
          beforeUpload={(file) => { setFileList(prev => [...prev, file]); return false; }}
          onRemove={(file) => { setFileList(prev => prev.filter(f => f.uid !== file.uid)); return false; }}
        >
          <Button icon={<UploadOutlined />}>选择文件</Button>
        </Upload>
        <Button type="primary" onClick={handleUpload} loading={loading}>上传</Button>
        <Button icon={<ReloadOutlined />} onClick={fetchFiles} disabled={loading}>刷新</Button>
      </Space>
      <Spin spinning={loading}>
        <List
          bordered
          dataSource={files}
          rowKey={(item) => item.filename || String(item)}
          renderItem={item => (
            <List.Item
              actions={[
                <Popconfirm title="确认删除该文件？" onConfirm={() => handleDelete(item.filename)} key="del">
                  <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
                </Popconfirm>
              ]}
            >
              <div>
                <div style={{ fontWeight: 500 }}>{item.filename || String(item)}</div>
                {(item.chunk_count != null || item.upload_time || item.student_can_download != null) && (
                  <div style={{ color: '#888', fontSize: 12 }}>
                    {item.chunk_count != null ? `分片: ${item.chunk_count} ` : ''}
                    {item.upload_time ? `上传时间: ${item.upload_time} ` : ''}
                    {item.student_can_download != null ? `学生可下载: ${item.student_can_download ? '是' : '否'}` : ''}
                  </div>
                )}
              </div>
            </List.Item>
          )}
        />
      </Spin>
    </AppLayout>
  );
}


