import http from '../api/http';
import * as teachingApi from '../api/teachingApi';

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


