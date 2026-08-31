import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_URL_BACKEND, // URL do seu backend
  withCredentials: true // MUITO IMPORTANTE: Diz ao navegador para enviar os cookies
});
