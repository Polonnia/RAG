import http from '../api/http';
import * as teachingApi from '../api/teachingApi';
import getApiUrl from '../apiConfig';

export async function getTeachingMaterials() {
  const res = await http.get('/teaching/materials');
  return res.data;
}

export async function getTeachingStructure(filename) {
  const formData = new FormData();
  formData.append('filename', filename);
  const res = await http.post('/teaching/structure', formData, { timeout: 120000 });
  return res.data;
}

export async function generateTeachingSchedule({ filename, selected_outline, total_hours, total_lessons }) {
  const formData = new FormData();
  formData.append('filename', filename);
  formData.append('selected_outline', selected_outline);
  formData.append('total_hours', String(total_hours));
  formData.append('total_lessons', String(total_lessons));
  const res = await http.post('/teaching/schedule', formData, { timeout: 120000 });
  return res.data;
}

export async function generateTeachingScheduleStream(
  { filename, selected_outline, total_hours, total_lessons },
  handlers = {}
) {
  const { onToken, onDone, onError, onStage } = handlers;

  const formData = new FormData();
  formData.append('filename', filename);
  formData.append('selected_outline', selected_outline);
  formData.append('total_hours', String(total_hours));
  formData.append('total_lessons', String(total_lessons));

  const token = localStorage.getItem('token');
  const response = await fetch(`${getApiUrl()}/teaching/schedule-stream`, {
    method: 'POST',
    body: formData,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok || !response.body) {
    let detail = '';
    try {
      const errorData = await response.json();
      detail = errorData?.detail || errorData?.error || '';
    } catch {
      detail = response.statusText;
    }
    throw new Error(detail || '流式生成失败');
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

    lines.forEach((line) => {
      const text = line.trim();
      if (!text) return;
      try {
        const payload = JSON.parse(text);
        if (payload.type === 'token') {
          onToken?.(payload.content || '');
        } else if (payload.type === 'stage') {
          onStage?.(payload);
        } else if (payload.type === 'done') {
          onDone?.(payload);
        } else if (payload.type === 'error') {
          onError?.(payload.message || '流式生成失败');
        }
      } catch {
        // ignore malformed NDJSON line
      }
    });
  }

  const tail = buffer.trim();
  if (tail) {
    try {
      const payload = JSON.parse(tail);
      if (payload.type === 'token') {
        onToken?.(payload.content || '');
      } else if (payload.type === 'stage') {
        onStage?.(payload);
      } else if (payload.type === 'done') {
        onDone?.(payload);
      } else if (payload.type === 'error') {
        onError?.(payload.message || '流式生成失败');
      }
    } catch {
      // ignore malformed tail line
    }
  }
}

export async function designTeachingPlan(courseOutline) {
  const formData = new FormData();
  formData.append('course_outline', courseOutline);
  const res = await http.post('/design-teaching-plan', formData, { timeout: 120000 });
  return res.data;
}

export async function saveTeachingPlanHistory({ outline, plan, lesson_schedule }) {
  return http.post('/teaching-plan-history', new URLSearchParams({ outline, plan, lesson_schedule })).then(r => r.data);
}

export async function getTeachingPlanHistory() {
  return http.get('/teaching-plan-history').then(r => r.data);
}

export async function deleteTeachingPlanHistory(id) {
  return http.delete(`/teaching-plan-history/${id}`).then(r => r.data);
}

export async function generateTeachingDetail(outline) {
  const formData = new FormData();
  formData.append('outline', outline);
  return http.post('/generate-teaching-detail', formData, { timeout: 180000 }).then(r => r.data);
}

export async function generatePPTFromOutline(detail) {
  const pptForm = new FormData();
  pptForm.append('outline', detail);
  return http.post('/teacher/generate-ppt-from-outline', pptForm).then(r => r.data);
}

export async function generatePPT(payload) {
  return teachingApi.generatePPT(payload);
}


