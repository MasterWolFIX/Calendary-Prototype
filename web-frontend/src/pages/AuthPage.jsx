// src/pages/AuthPage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import './AuthPage.css';

export default function AuthPage() {
    const navigate = useNavigate();
    const [tab, setTab] = useState('login');
    const [email, setEmail] = useState('');
    const [password, setPass] = useState('');
    const [confirmPassword, setConfirmPass] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const switchTab = (t) => { setTab(t); setError(''); setConfirmPass(''); };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (tab === 'register') {
            if (password.length < 8) { setError('Hasło musi mieć co najmniej 8 znaków.'); return; }
            if (password !== confirmPassword) { setError('Hasła nie są zgodne.'); return; }
        }

        setLoading(true);
        try {
            const endpoint = tab === 'login' ? '/auth/login' : '/auth/register';
            const { data } = await api.post(endpoint, { email, password });
            const storage = rememberMe ? localStorage : sessionStorage;
            storage.setItem('calendary_token', data.token);
            storage.setItem('calendary_user', JSON.stringify(data.user));
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
                <div className="auth-logo">
                    <div className="auth-logo-mark">
                        {/* Ikona kalendarza SVG */}
                        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="3"/>
                            <path d="M16 2v4M8 2v4M3 10h18"/>
                            <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>
                        </svg>
                    </div>
                    <h1>Calendary</h1>
                    <p>Twój inteligentny kalendarz</p>
                </div>

                <div className="auth-tabs">
                    <button className={`auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => switchTab('login')}>
                        Logowanie
                    </button>
                    <button className={`auth-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => switchTab('register')}>
                        Rejestracja
                    </button>
                </div>

                <form className="auth-form" onSubmit={handleSubmit}>
                    {error && <div className="alert alert-error">{error}</div>}

                    <div className="form-group">
                        <label className="form-label" htmlFor="auth-email">Adres e-mail</label>
                        <input id="auth-email" type="email" className="form-input"
                            placeholder="ty@example.com" value={email}
                            onChange={(e) => setEmail(e.target.value)} required autoFocus />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="auth-password">Hasło</label>
                        <input id="auth-password" type="password" className="form-input"
                            placeholder={tab === 'register' ? 'Min. 8 znaków' : '••••••••'}
                            value={password} onChange={(e) => setPass(e.target.value)} required />
                    </div>

                    {tab === 'register' && (
                        <div className="form-group">
                            <label className="form-label" htmlFor="auth-confirm">Powtórz hasło</label>
                            <input id="auth-confirm" type="password" className="form-input"
                                placeholder="Powtórz hasło" value={confirmPassword}
                                onChange={(e) => setConfirmPass(e.target.value)} required />
                        </div>
                    )}

                    <label className="auth-remember">
                        <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                        <span className="auth-remember-box" />
                        <span>Zapamiętaj mnie na tym urządzeniu</span>
                    </label>

                    <button id="auth-submit" type="submit" className="btn btn-primary btn-full auth-submit" disabled={loading}>
                        {loading ? <span className="spinner" /> : tab === 'login' ? 'Zaloguj się' : 'Utwórz konto'}
                    </button>
                </form>

                <p className="auth-footer">
                    {tab === 'login' ? 'Nie masz konta? Przejdź do Rejestracji powyżej.' : 'Masz już konto? Przejdź do Logowania powyżej.'}
                </p>
            </div>
        </div>
    );
}
