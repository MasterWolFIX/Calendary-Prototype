// src/components/EventModal.jsx
import { useState, useEffect } from 'react';

const EVENT_COLORS = [
    '#7c5cfc', '#06b6d4', '#f59e0b', '#34d399',
    '#f87171', '#fb7185', '#a78bfa', '#38bdf8',
];

function toLocalDatetimeValue(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EventModal({ event, onClose, onSave, onDelete }) {
    const isEditing = Boolean(event?.id);

    const [title, setTitle] = useState('');
    const [desc, setDesc] = useState('');
    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');
    const [color, setColor] = useState(EVENT_COLORS[0]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (event) {
            setTitle(event.title || '');
            setDesc(event.description || '');
            setStart(toLocalDatetimeValue(event.start || event.start_date));
            setEnd(toLocalDatetimeValue(event.end || event.end_date));
            setColor(event.color || EVENT_COLORS[0]);
        }
    }, [event]);

    const handleSave = async (e) => {
        e.preventDefault();
        setError('');
        if (!title.trim()) { setError('Tytuł jest wymagany.'); return; }
        if (!start || !end) { setError('Daty są wymagane.'); return; }
        if (new Date(start) >= new Date(end)) { setError('Data końca musi być późniejsza niż data początku.'); return; }

        setLoading(true);
        try {
            await onSave({ title, description: desc, start_date: new Date(start).toISOString(), end_date: new Date(end).toISOString(), color });
            onClose();
        } catch (err) {
            setError(err.response?.data?.error || 'Błąd zapisu.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('Czy na pewno chcesz usunąć to wydarzenie?')) return;
        setLoading(true);
        try {
            await onDelete(event.id);
            onClose();
        } catch (err) {
            setError('Błąd usuwania.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal">
                <div className="modal-header">
                    <span className="modal-title">{isEditing ? '✏️ Edytuj wydarzenie' : '➕ Nowe wydarzenie'}</span>
                    <button className="modal-close" onClick={onClose} aria-label="Zamknij">✕</button>
                </div>

                <form onSubmit={handleSave}>
                    <div className="modal-body">
                        {error && <div className="alert alert-error">{error}</div>}

                        <div className="form-group">
                            <label className="form-label" htmlFor="ev-title">Tytuł *</label>
                            <input
                                id="ev-title"
                                className="form-input"
                                type="text"
                                placeholder="np. Spotkanie z klientem"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="ev-desc">Opis (opcjonalnie)</label>
                            <textarea
                                id="ev-desc"
                                className="form-input"
                                placeholder="Dodatkowe szczegóły..."
                                value={desc}
                                onChange={(e) => setDesc(e.target.value)}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div className="form-group">
                                <label className="form-label" htmlFor="ev-start">Początek *</label>
                                <input
                                    id="ev-start"
                                    className="form-input"
                                    type="datetime-local"
                                    value={start}
                                    onChange={(e) => setStart(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="ev-end">Koniec *</label>
                                <input
                                    id="ev-end"
                                    className="form-input"
                                    type="datetime-local"
                                    value={end}
                                    onChange={(e) => setEnd(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        {/* Color picker */}
                        <div className="form-group">
                            <label className="form-label">Kolor</label>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {EVENT_COLORS.map((c) => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => setColor(c)}
                                        title={c}
                                        style={{
                                            width: 28, height: 28,
                                            borderRadius: '50%',
                                            background: c,
                                            border: color === c ? '3px solid #fff' : '3px solid transparent',
                                            outline: color === c ? `2px solid ${c}` : 'none',
                                            cursor: 'pointer',
                                            transition: 'transform 0.15s',
                                            transform: color === c ? 'scale(1.2)' : 'scale(1)',
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="modal-footer">
                        {isEditing && (
                            <button type="button" className="btn btn-danger btn-sm" onClick={handleDelete} disabled={loading}>
                                🗑 Usuń
                            </button>
                        )}
                        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={loading}>
                            Anuluj
                        </button>
                        <button id="ev-save" type="submit" className="btn btn-primary btn-sm" disabled={loading}>
                            {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : isEditing ? 'Zapisz zmiany' : 'Dodaj wydarzenie'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
