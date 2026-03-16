// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import CalendarPage from './pages/CalendarPage';

// Token może być w localStorage (zapamiętaj mnie) lub sessionStorage (sesja)
const getToken = () =>
  localStorage.getItem('calendary_token') || sessionStorage.getItem('calendary_token');

function PrivateRoute({ children }) {
  return getToken() ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  return !getToken() ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={<PublicRoute><AuthPage /></PublicRoute>}
        />
        <Route
          path="/"
          element={<PrivateRoute><CalendarPage /></PrivateRoute>}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
