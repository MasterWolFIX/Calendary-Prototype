// src/pages/AuthPage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import './AuthPage.css';

export default function AuthPage() {
    const navigate = useNavigate();
    const [tab, setTab] = useState('login'); // 'login' | 'register'
    const [email, setEmail] = useState('');
    const [password, setPass] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const endpoint = tab === 'login' ? '/auth/login' : '/auth/register';
            const { data } = await api.post(endpoint, { email, password });

            localStorage.setItem('calendary_token', data.token);
            localStorage.setItem('calendary_user', JSON.stringify(data.user));
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.error || 'Błąd połączenia z serwerem.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-root">
            <div className="auth-card">

                {/* Logo */}
                <div className="auth-logo">
                    <span className="auth-logo-icon">📅</span>
                    <h1>Calendary</h1>
                    <p>Twój inteligentny kalendarz</p>
                </div>

                {/* Tabs */}
                <div className="auth-tabs">
                    <button
                        className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
                        onClick={() => { setTab('login'); setError(''); }}
                    >
                        Logowanie
                    </button>
                    <button
                        className={`auth-tab ${tab === 'register' ? 'active' : ''}`}
                        onClick={() => { setTab('register'); setError(''); }}
                    >
                        Rejestracja
                    </button>
                </div>

                {/* Form */}
                <form className="auth-form" onSubmit={handleSubmit}>
                    {error && <div className="alert alert-error">{error}</div>}

                    <div className="form-group">
                        <label className="form-label" htmlFor="auth-email">Adres e-mail</label>
                        <input
                            id="auth-email"
                            type="email"
                            className="form-input"
                            placeholder="ty@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="auth-password">Hasło</label>
                        <input
                            id="auth-password"
                            type="password"
                            className="form-input"
                            placeholder={tab === 'register' ? 'Minimum 8 znaków' : '••••••••'}
                            value={password}
                            onChange={(e) => setPass(e.target.value)}
                            required
                        />
                    </div>

                    <button
                        id="auth-submit"
                        type="submit"
                        className="btn btn-primary btn-full"
                        disabled={loading}
                        style={{ marginTop: 4, padding: '13px' }}
                    >
                        {loading
                            ? <span className="spinner" />
                            : tab === 'login' ? 'Zaloguj się' : 'Utwórz konto'
                        }
                    </button>
                </form>

                <p className="auth-divider">
                    {tab === 'login'
                        ? 'Nie masz konta? Kliknij „Rejestracja" powyżej.'
                        : 'Masz już konto? Kliknij „Logowanie" powyżej.'
                    }
                </p>
            </div>
        </div>
    );
}
