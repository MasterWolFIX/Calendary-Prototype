// src/pages/CalendarPage.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import plLocale from '@fullcalendar/core/locales/pl';
import api from '../api';
import EventModal from '../components/EventModal';
import './CalendarPage.css';

export default function CalendarPage() {
    const navigate = useNavigate();
    const calendarRef = useRef(null);
    const [events, setEvents] = useState([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [editEvent, setEditEvent] = useState(null);  // null = nowe, obj = edycja
    const [view, setView] = useState('dayGridMonth');
    const [loading, setLoading] = useState(true);

    const user = JSON.parse(localStorage.getItem('calendary_user') || '{}');

    // ── Pobierz wydarzenia z API ───────────────────────────────────────────────
    const fetchEvents = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/events');
            // Mapujemy na format FullCalendar
            const fcEvents = data.events.map((e) => ({
                id: String(e.id),
                title: e.title,
                start: e.start_date,
                end: e.end_date,
                backgroundColor: e.color || '#7c5cfc',
                extendedProps: {
                    description: e.description,
                    notified: e.notified,
                    start_date: e.start_date,
                    end_date: e.end_date,
                },
            }));
            setEvents(fcEvents);
        } catch {
            // 401 obsługuje interceptor w api.js
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchEvents(); }, [fetchEvents]);

    // ── Zmiana widoku kalendarza ───────────────────────────────────────────────
    const switchView = (v) => {
        setView(v);
        calendarRef.current?.getApi().changeView(v);
    };

    // ── Klik w pusty slot → otwórz modal z wypełnionymi datami ───────────────
    const handleDateSelect = ({ start, end }) => {
        setEditEvent({ start: start.toISOString(), end: end.toISOString() });
        setModalOpen(true);
    };

    // ── Klik w istniejące wydarzenie → otwórz modal edycji ───────────────────
    const handleEventClick = ({ event }) => {
        setEditEvent({
            id: event.id,
            title: event.title,
            description: event.extendedProps.description,
            start_date: event.extendedProps.start_date,
            end_date: event.extendedProps.end_date,
            color: event.backgroundColor,
        });
        setModalOpen(true);
    };

    // ── Drag & drop – przesuń wydarzenie ────────────────────────────────────
    const handleEventDrop = async ({ event }) => {
        try {
            await api.put(`/events/${event.id}`, {
                start_date: event.start.toISOString(),
                end_date: (event.end || event.start).toISOString(),
            });
            fetchEvents();
        } catch {
            fetchEvents(); // revert na błąd
        }
    };

    // ── Zapis nowego lub zaktualizowanego wydarzenia ───────────────────────────
    const handleSave = async (formData) => {
        if (editEvent?.id) {
            await api.put(`/events/${editEvent.id}`, formData);
        } else {
            await api.post('/events', formData);
        }
        await fetchEvents();
    };

    // ── Usuwanie ──────────────────────────────────────────────────────────────
    const handleDelete = async (id) => {
        await api.delete(`/events/${id}`);
        await fetchEvents();
    };

    const handleLogout = () => {
        localStorage.removeItem('calendary_token');
        localStorage.removeItem('calendary_user');
        navigate('/login');
    };

    const todayEvents = events.filter((e) => {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
        const s = new Date(e.start);
        return s >= today && s < tomorrow;
    });

    const upcomingCount = events.filter((e) => new Date(e.start) >= new Date()).length;
    const initial = (user.email || '?')[0].toUpperCase();

    return (
        <div className="app-layout">
            {/* ── Sidebar ───────────────────────────────────────────────────────── */}
            <aside className="sidebar">
                <div className="sidebar-logo">
                    <span className="sidebar-logo-icon">📅</span>
                    <span className="sidebar-logo-text">Calendary</span>
                </div>

                <span className="sidebar-section-label">Widok</span>
                <button
                    className={`sidebar-item ${view === 'dayGridMonth' ? 'active' : ''}`}
                    onClick={() => switchView('dayGridMonth')}
                >
                    <span className="sidebar-item-icon">🗓</span> Miesiąc
                </button>
                <button
                    className={`sidebar-item ${view === 'timeGridWeek' ? 'active' : ''}`}
                    onClick={() => switchView('timeGridWeek')}
                >
                    <span className="sidebar-item-icon">📆</span> Tydzień
                </button>
                <button
                    className={`sidebar-item ${view === 'timeGridDay' ? 'active' : ''}`}
                    onClick={() => switchView('timeGridDay')}
                >
                    <span className="sidebar-item-icon">📋</span> Dzień
                </button>

                <span className="sidebar-section-label">Akcje</span>
                <button
                    id="btn-new-event"
                    className="sidebar-item"
                    onClick={() => { setEditEvent(null); setModalOpen(true); }}
                >
                    <span className="sidebar-item-icon">➕</span> Nowe wydarzenie
                </button>

                <div className="sidebar-spacer" />

                <div className="sidebar-user">
                    <div className="sidebar-avatar">{initial}</div>
                    <div className="sidebar-user-info">
                        <div className="sidebar-user-email">{user.email}</div>
                    </div>
                    <button className="sidebar-logout" onClick={handleLogout} title="Wyloguj się">⏻</button>
                </div>
            </aside>

            {/* ── Main ──────────────────────────────────────────────────────────── */}
            <div className="main-content">
                {/* Topbar */}
                <div className="topbar">
                    <div>
                        <div className="topbar-title">Twój Kalendarz</div>
                        <div className="topbar-subtitle">
                            {new Date().toLocaleDateString('pl-PL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </div>
                    </div>
                    <button
                        id="btn-add-event-topbar"
                        className="btn btn-primary"
                        style={{ gap: 6 }}
                        onClick={() => { setEditEvent(null); setModalOpen(true); }}
                    >
                        ➕ Dodaj wydarzenie
                    </button>
                </div>

                {/* Stats */}
                <div className="stats-bar">
                    <div className="stat-chip stat-chip-accent">
                        <span>📅</span>
                        <span>Dzisiaj: <span className="stat-chip-value">{todayEvents.length}</span></span>
                    </div>
                    <div className="stat-chip">
                        <span>🔮</span>
                        <span>Nadchodzące: <span className="stat-chip-value">{upcomingCount}</span></span>
                    </div>
                    <div className="stat-chip">
                        <span>📊</span>
                        <span>Łącznie: <span className="stat-chip-value">{events.length}</span></span>
                    </div>
                    {loading && <div className="stat-chip"><span className="spinner" style={{ width: 14, height: 14 }} /></div>}
                </div>

                {/* Calendar */}
                <div className="calendar-wrapper">
                    <FullCalendar
                        ref={calendarRef}
                        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                        initialView={view}
                        locale={plLocale}
                        headerToolbar={{
                            left: 'prev,next today',
                            center: 'title',
                            right: '',
                        }}
                        events={events}
                        selectable
                        selectMirror
                        editable
                        dayMaxEvents={3}
                        select={handleDateSelect}
                        eventClick={handleEventClick}
                        eventDrop={handleEventDrop}
                        eventResizableFromStart
                        height="100%"
                        nowIndicator
                    />
                </div>
            </div>

            {/* ── Modal ─────────────────────────────────────────────────────────── */}
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
