import axios from 'axios';

const API_URL = 'http://localhost:5000';

export const signup = (email, password) =>
  axios.post(`${API_URL}/auth/signup`, { email, password });

export const login = (email, password) =>
  axios.post(`${API_URL}/auth/login`, { email, password });

export const getFiles = (token) =>
  axios.get(`${API_URL}/files`, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const uploadFile = (token, file, onProgress, abortSignal) => {
  const formData = new FormData();
  formData.append('file', file);
  return axios.post(`${API_URL}/files/upload`, formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'multipart/form-data',
    },
    signal: abortSignal,
    onUploadProgress: (e) => {
      if (onProgress) {
        const percent = Math.round((e.loaded * 100) / e.total);
        onProgress(percent);
      }
    },
  });
};

export const getDownloadLink = (token, fileId) =>
  axios.get(`${API_URL}/files/${fileId}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const deleteFile = (token, fileId) =>
  axios.delete(`${API_URL}/files/${fileId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });