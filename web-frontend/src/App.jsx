// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import CalendarPage from './pages/CalendarPage';

function PrivateRoute({ children }) {
  const token = localStorage.getItem('calendary_token');
  return token ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const token = localStorage.getItem('calendary_token');
  return !token ? children : <Navigate to="/" replace />;
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
