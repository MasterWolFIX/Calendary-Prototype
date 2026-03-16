// src/pages/CalendarPage.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import plLocale from '@fullcalendar/core/locales/pl';
import api, { clearSession } from '../api';
import EventModal from '../components/EventModal';
import './CalendarPage.css';

const getUser = () => {
    try {
        return JSON.parse(
            localStorage.getItem('calendary_user') ||
            sessionStorage.getItem('calendary_user') || '{}'
        );
    } catch { return {}; }
};

// ── SVG Icons ─────────────────────────────────────────────────────────────
const IconCalendar = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="3"/>
        <path d="M16 2v4M8 2v4M3 10h18"/>
    </svg>
);
const IconWeek = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18M3 12h18M3 18h18"/>
    </svg>
);
const IconDay = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="3"/>
        <path d="M3 10h18M8 2v4M16 2v4M8 14h.01M12 14h.01M16 14h.01"/>
    </svg>
);
const IconPlus = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
);
const IconPower = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18.36 6.64A9 9 0 1 1 5.64 6.64"/><line x1="12" y1="2" x2="12" y2="12"/>
    </svg>
);

export default function CalendarPage() {
    const navigate = useNavigate();
    const calendarRef = useRef(null);
    const [events, setEvents] = useState([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [editEvent, setEditEvent] = useState(null);
    const [view, setView] = useState('dayGridMonth');
    const [loading, setLoading] = useState(true);
    const user = getUser();

    const fetchEvents = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/events');
            const fcEvents = data.events.map((e) => ({
                id: String(e.id),
                title: e.title,
                start: e.start_date,
                end: e.end_date,
                backgroundColor: '#6366f1',
                borderColor: '#6366f1',
                extendedProps: {
                    description: e.description,
                    start_date: e.start_date,
                    end_date: e.end_date,
                },
            }));
            setEvents(fcEvents);
        } catch {
            // 401 obsługuje interceptor
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchEvents(); }, [fetchEvents]);

    const switchView = (v) => {
        setView(v);
        calendarRef.current?.getApi().changeView(v);
    };

    const handleDateSelect = ({ start, end }) => {
        setEditEvent({ start: start.toISOString(), end: end.toISOString() });
        setModalOpen(true);
    };

    const handleEventClick = ({ event }) => {
        setEditEvent({
            id: event.id,
            title: event.title,
            description: event.extendedProps.description,
            start_date: event.extendedProps.start_date,
            end_date: event.extendedProps.end_date,
        });
        setModalOpen(true);
    };

    const handleEventDrop = async ({ event }) => {
        try {
            await api.put(`/events/${event.id}`, {
                start_date: event.start.toISOString(),
                end_date: (event.end || event.start).toISOString(),
            });
            fetchEvents();
        } catch { fetchEvents(); }
    };

    const handleSave = async (formData) => {
        if (editEvent?.id) await api.put(`/events/${editEvent.id}`, formData);
        else await api.post('/events', formData);
        await fetchEvents();
    };

    const handleDelete = async (id) => {
        await api.delete(`/events/${id}`);
        await fetchEvents();
    };

    const handleLogout = () => {
        clearSession();
        navigate('/login');
    };

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const todayCount = events.filter(e => { const s = new Date(e.start); return s >= today && s < tomorrow; }).length;
    const upcomingCount = events.filter(e => new Date(e.start) >= new Date()).length;
    const initial = (user.email || '?')[0].toUpperCase();

    return (
        <div className="app-layout">
            {/* ── Sidebar ── */}
            <aside className="sidebar">
                <div className="sidebar-logo">
                    <div className="sidebar-logo-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="3"/>
                            <path d="M16 2v4M8 2v4M3 10h18"/>
                        </svg>
                    </div>
                    <span className="sidebar-logo-text">Calendary</span>
                </div>

                <div className="sidebar-section">
                    <span className="sidebar-section-label">Widok</span>
                    <button className={`sidebar-nav-item ${view === 'dayGridMonth' ? 'active' : ''}`} onClick={() => switchView('dayGridMonth')}>
                        <IconCalendar /> Miesiąc
                    </button>
                    <button className={`sidebar-nav-item ${view === 'timeGridWeek' ? 'active' : ''}`} onClick={() => switchView('timeGridWeek')}>
                        <IconWeek /> Tydzień
                    </button>
                    <button className={`sidebar-nav-item ${view === 'timeGridDay' ? 'active' : ''}`} onClick={() => switchView('timeGridDay')}>
                        <IconDay /> Dzień
                    </button>
                </div>

                <div className="sidebar-section">
                    <span className="sidebar-section-label">Akcje</span>
                    <button id="btn-new-event" className="sidebar-nav-item" onClick={() => { setEditEvent(null); setModalOpen(true); }}>
                        <IconPlus /> Nowe wydarzenie
                    </button>
                </div>

                <div className="sidebar-spacer" />

                <div className="sidebar-bottom">
                    <div className="sidebar-user">
                        <div className="sidebar-avatar">{initial}</div>
                        <span className="sidebar-user-email">{user.email}</span>
                        <button className="sidebar-logout" onClick={handleLogout} title="Wyloguj się">
                            <IconPower />
                        </button>
                    </div>
                </div>
            </aside>

            {/* ── Main ── */}
            <div className="main-content">
                {loading && <div className="loading-bar" />}

                <div className="topbar">
                    <div className="topbar-left">
                        <div className="topbar-title">Twój kalendarz</div>
                        <div className="topbar-subtitle">
                            {new Date().toLocaleDateString('pl-PL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </div>
                    </div>
                    <div className="topbar-right">
                        <button id="btn-add-event-topbar" className="btn btn-primary btn-sm" onClick={() => { setEditEvent(null); setModalOpen(true); }}>
                            <IconPlus /> Dodaj wydarzenie
                        </button>
                    </div>
                </div>

                <div className="stats-strip">
                    <div className="stat-item accent">
                        <span className="stat-label">Dzisiaj</span>
                        <span className="stat-value">{todayCount}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">Nadchodzące</span>
                        <span className="stat-value">{upcomingCount}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">Łącznie</span>
                        <span className="stat-value">{events.length}</span>
                    </div>
                </div>

                <div className="calendar-wrapper">
                    <FullCalendar
                        ref={calendarRef}
                        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                        initialView={view}
                        locale={plLocale}
                        headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
                        events={events}
                        selectable
                        selectMirror
                        editable
                        dayMaxEvents={4}
                        select={handleDateSelect}
                        eventClick={handleEventClick}
                        eventDrop={handleEventDrop}
                        height="100%"
                        nowIndicator
                    />
                </div>
            </div>

            {modalOpen && (
                <EventModal
                    event={editEvent}
                    onClose={() => { setModalOpen(false); setEditEvent(null); }}
                    onSave={handleSave}
                    onDelete={handleDelete}
                />
            )}
        </div>
    );
}
