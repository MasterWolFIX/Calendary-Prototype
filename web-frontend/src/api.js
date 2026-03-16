// src/api.js – Centralny klient HTTP dla Calendary API
import axios from 'axios';

// Helper: czyta token z localStorage (zapamiętaj mnie) lub sessionStorage (sesja)
const getToken = () =>
    localStorage.getItem('calendary_token') || sessionStorage.getItem('calendary_token');

const clearSession = () => {
    localStorage.removeItem('calendary_token');
    localStorage.removeItem('calendary_user');
    sessionStorage.removeItem('calendary_token');
    sessionStorage.removeItem('calendary_user');
};

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
    headers: { 'Content-Type': 'application/json' },
});

// Automatycznie dołącz token JWT do każdego żądania
api.interceptors.request.use((config) => {
    const token = getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// Jeśli token wygasł (401) – wyloguj użytkownika, pomiń dla zapytań logowania
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 && !error.config.url.includes('/auth/')) {
            clearSession();
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export { getToken, clearSession };
export default api;
