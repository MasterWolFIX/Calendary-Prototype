// src/api.js – Centralny klient HTTP dla Calendary API
import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
    headers: { 'Content-Type': 'application/json' },
});

// Automatycznie dołącz token JWT do każdego żądania
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('calendary_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// Jeśli token wygasł (401) – wyloguj użytkownika
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('calendary_token');
            localStorage.removeItem('calendary_user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;
