import * as knowledgeApi from '../api/knowledgeApi';

export async function getDocuments() {
  return knowledgeApi.listDocuments();
}

export async function upload(formData) {
  return knowledgeApi.uploadDocument(formData);
}

export async function removeDocument(id) {
  return knowledgeApi.deleteDocument(id);
}

export async function ask(payload) {
  return knowledgeApi.askQuestion(payload);
}


