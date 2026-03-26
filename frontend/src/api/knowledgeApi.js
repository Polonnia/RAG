import http from './http';

export const listDocuments = () => http.get('/knowledge-files').then(r => r.data);
export const uploadDocument = (formData) =>
  http.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 }).then(r => r.data);
export const deleteDocument = (filename) => http.delete(`/delete-file/${encodeURIComponent(filename)}`).then(r => r.data);
export const askQuestion = (formData) =>
  http.post('/qa', formData, { timeout: 180000 }).then(r => r.data);

export default { listDocuments, uploadDocument, deleteDocument, askQuestion };