import http from '../api/http';
import getApiUrl from '../apiConfig';

export async function generateExam({ courseOutline, questionConfig, difficulty }) {
  const formData = new FormData();
  formData.append('course_outline', courseOutline);
  formData.append('question_config', JSON.stringify(questionConfig));
  formData.append('difficulty', difficulty);
  const res = await http.post('/generate-exam', formData, { timeout: 180000 });
  return res.data;
}

export async function generateExamStream({ courseOutline, questionConfig, difficulty, onEvent }) {
  const formData = new FormData();
  formData.append('course_outline', courseOutline);
  formData.append('question_config', JSON.stringify(questionConfig));
  formData.append('difficulty', difficulty);

  const token = localStorage.getItem('token');
  const response = await fetch(`${getApiUrl()}/generate-exam-stream`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(errText || `HTTP ${response.status}`);
  }

  if (!response.body) {
    throw new Error('浏览器不支持流式响应');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const event = JSON.parse(trimmed);
        if (onEvent) onEvent(event);
      } catch {
        // 忽略非JSON片段
      }
    }
  }

  const tail = buffer.trim();
  if (tail) {
    try {
      const event = JSON.parse(tail);
      if (onEvent) onEvent(event);
    } catch {
      // 忽略尾部非JSON片段
    }
  }
}

export async function saveExamHistory(outline, examContent) {
  return http.post('/exam-history', new URLSearchParams({ outline, exam_content: JSON.stringify(examContent) })).then(r => r.data);
}

export async function getExamHistory() {
  return http.get('/exam-history').then(r => r.data);
}

export async function deleteExamHistory(id) {
  return http.delete(`/exam-history/${id}`).then(r => r.data);
}

export async function listTeacherExams() {
  return http.get('/teacher/exams').then(r => r.data);
}

export async function createExam({ title, description, duration, questions }) {
  const formData = new FormData();
  formData.append('title', title);
  formData.append('description', description);
  formData.append('duration', duration);
  formData.append('questions_data', JSON.stringify(questions));
  return http.post('/create-exam', formData).then(r => r.data);
}


