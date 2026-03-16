// src/components/EventModal.jsx
import { useState, useEffect } from 'react';

const DEFAULT_COLOR = '#6366f1';

function toLocalDatetimeValue(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// SVG Icons
const IconEdit = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
);
const IconPlus = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
);
const IconClose = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
);
const IconTrash = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
        <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
    </svg>
);

export default function EventModal({ event, onClose, onSave, onDelete }) {
    const isEditing = Boolean(event?.id);
    const [title, setTitle] = useState('');
    const [desc, setDesc] = useState('');
    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');
    const [hasEnd, setHasEnd] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (event) {
            setTitle(event.title || '');
            setDesc(event.description || '');
            setStart(toLocalDatetimeValue(event.start || event.start_date));
            if (event.end_date && event.end_date !== event.start_date) {
                setEnd(toLocalDatetimeValue(event.end || event.end_date));
                setHasEnd(true);
            } else {
                setEnd(''); setHasEnd(false);
            }
        }
    }, [event]);

    const handleSave = async (e) => {
        e.preventDefault();
        setError('');
        if (!title.trim()) { setError('Tytuł jest wymagany.'); return; }
        if (!start) { setError('Data i godzina są wymagane.'); return; }
        if (hasEnd && !end) { setError('Podaj czas zakończenia.'); return; }
        if (hasEnd && new Date(start) >= new Date(end)) {
            setError('Czas zakończenia musi być późniejszy niż rozpoczęcia.'); return;
        }
        setLoading(true);
        try {
            await onSave({
                title, description: desc,
                start_date: new Date(start).toISOString(),
                end_date: hasEnd ? new Date(end).toISOString() : null,
                color: DEFAULT_COLOR,
            });
            onClose();
        } catch (err) {
            setError(err.response?.data?.error || 'Błąd zapisu.');
        } finally { setLoading(false); }
    };

    const handleDelete = async () => {
        if (!window.confirm('Usunąć to wydarzenie?')) return;
        setLoading(true);
        try { await onDelete(event.id); onClose(); }
        catch { setError('Błąd usuwania.'); }
        finally { setLoading(false); }
    };

    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal">
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ color: 'var(--accent)' }}>
                            {isEditing ? <IconEdit /> : <IconPlus />}
                        </div>
                        <span className="modal-title">
                            {isEditing ? 'Edytuj wydarzenie' : 'Nowe wydarzenie'}
                        </span>
                    </div>
                    <button className="modal-close" onClick={onClose} aria-label="Zamknij">
                        <IconClose />
                    </button>
                </div>

                <form onSubmit={handleSave}>
                    <div className="modal-body">
                        {error && <div className="alert alert-error">{error}</div>}

                        <div className="form-group">
                            <label className="form-label" htmlFor="ev-title">Tytuł</label>
                            <input id="ev-title" className="form-input" type="text"
                                placeholder="Nazwa wydarzenia" value={title}
                                onChange={(e) => setTitle(e.target.value)} required autoFocus />
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="ev-desc">Opis</label>
                            <textarea id="ev-desc" className="form-input"
                                placeholder="Dodatkowe szczegóły (opcjonalnie)"
                                value={desc} onChange={(e) => setDesc(e.target.value)} />
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="ev-start">Data i godzina rozpoczęcia</label>
                            <input id="ev-start" className="form-input" type="datetime-local"
                                value={start} onChange={(e) => setStart(e.target.value)} required />
                        </div>

                        <label className="check-label">
                            <input type="checkbox" checked={hasEnd} onChange={(e) => setHasEnd(e.target.checked)} />
                            <span className="check-box" />
                            <span>Ustaw godzinę zakończenia</span>
                        </label>

                        {hasEnd && (
                            <div className="form-group">
                                <label className="form-label" htmlFor="ev-end">Data i godzina zakończenia</label>
                                <input id="ev-end" className="form-input" type="datetime-local"
                                    value={end} onChange={(e) => setEnd(e.target.value)} required={hasEnd} />
                            </div>
                        )}
                    </div>

                    <div className="modal-footer">
                        {isEditing && (
                            <button type="button" className="btn btn-danger btn-sm" onClick={handleDelete} disabled={loading}>
                                <IconTrash /> Usuń
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
