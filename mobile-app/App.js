import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  ActivityIndicator, StatusBar, KeyboardAvoidingView,
  Platform, FlatList, Modal, Switch, ScrollView, useColorScheme
} from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import { PanResponder } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

import { NavigationContainer } from '@react-navigation/native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';

// ── Powiadomienia ──────────────────────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ── Język PL ───────────────────────────────────────────────────────────────
LocaleConfig.locales['pl'] = {
  monthNames: ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'],
  monthNamesShort: ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'],
  dayNames: ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'],
  dayNamesShort: ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'],
  today: 'Dzisiaj',
};
LocaleConfig.defaultLocale = 'pl';

const API_URL = 'https://api.slezinski.com/api';

// Motywy
const THEMES = {
  dark: {
    bg: '#07090F',
    surface: '#0D1117',
    card: '#111827',
    border: 'rgba(255,255,255,0.07)',
    accent: '#6366f1',
    accentDim: 'rgba(99,102,241,0.12)',
    text: '#e2e8f0',
    sub: '#64748b',
    muted: '#374151',
    danger: '#ef4444',
  },
  light: {
    bg: '#F8FAFC',
    surface: '#FFFFFF',
    card: '#FFFFFF',
    border: 'rgba(0,0,0,0.06)',
    accent: '#6366f1',
    accentDim: 'rgba(99,102,241,0.08)',
    text: '#1E293B',
    sub: '#64748b',
    muted: '#94A3B8',
    danger: '#ef4444',
  }
};

const RECURRENCE_OPTIONS = [
  { label: 'Brak powtarzania', value: 'none' },
  { label: 'Codziennie', value: 'daily' },
  { label: 'Co tydzień', value: 'weekly' },
  { label: 'Co miesiąc', value: 'monthly' },
];

const NOTIF_OPTIONS = [
  { label: 'W momencie wydarzenia', value: 0 },
  { label: '5 minut wcześniej', value: 5 },
  { label: '10 minut wcześniej', value: 10 },
  { label: '15 minut wcześniej', value: 15 },
  { label: '30 minut wcześniej', value: 30 },
  { label: '1 godzinę wcześniej', value: 60 },
  { label: '2 godziny wcześniej', value: 120 },
  { label: '1 dzień wcześniej', value: 1440 },
];

function getTheme(mode) { return THEMES[mode] || THEMES.dark; }

async function scheduleNotification(title, startISO, minutes = 15) {
  const triggerDate = new Date(startISO);
  triggerDate.setMinutes(triggerDate.getMinutes() - minutes);
  if (triggerDate <= new Date()) return;
  const bodyLabel = minutes === 0
    ? `Teraz: ${title}`
    : `Za ${minutes < 60 ? `${minutes} min` : minutes === 1440 ? '1 dzień' : `${minutes / 60}h`}: ${title}`;
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Przypomnienie – Calendary', body: bodyLabel, sound: true },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });
}

async function registerPush(token) {
  try {
    if (!Device.isDevice) return;
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;
    const d = await Notifications.getExpoPushTokenAsync();
    if (d?.data)
      await axios.post(`${API_URL}/auth/fcm-token`, { token: d.data }, { headers: { Authorization: `Bearer ${token}` } });
  } catch (e) { console.log('push (ignorowane):', e.message); }
}

const fmt = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const fmtDateShort = (d) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;

const formatDate = (iso) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });

const Tab = createMaterialTopTabNavigator();

// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const mode = useColorScheme();
  const C = getTheme(mode);
  const s = createStyles(C);
  const COLORS = [C.accent, '#ef4444', '#10b981', '#f59e0b', '#3b82f6', '#ec4899'];

  const calTheme = {
    calendarBackground: C.surface,
    textSectionTitleColor: C.sub,
    selectedDayBackgroundColor: C.accent,
    selectedDayTextColor: '#fff',
    todayTextColor: C.accent,
    todayBackgroundColor: C.accentDim,
    dayTextColor: C.text,
    textDisabledColor: mode === 'dark' ? '#1f2937' : '#e2e8f0',
    dotColor: C.accent,
    selectedDotColor: '#fff',
    arrowColor: C.accent,
    monthTextColor: C.text,
    textDayFontWeight: '500',
    textMonthFontWeight: '700',
    textDayHeaderFontWeight: '600',
    textDayFontSize: 14,
    textMonthFontSize: 15,
    textDayHeaderFontSize: 11,
  };

  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [eventsMap, setEventsMap] = useState({});
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // auth
  const [authTab, setAuthTab] = useState('login');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [confirmPass, setConf] = useState('');
  const [authLoading, setAL] = useState(false);

  // modal
  const [modal, setModal] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [startTime, setStart] = useState(new Date());
  const [hasEnd, setHasEnd] = useState(false);
  const [endTime, setEnd] = useState(new Date());
  const [picker, setPicker] = useState(false);
  const [pickerFor, setPickerFor] = useState('start');
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [recurrence, setRecurrence] = useState('none');
  const [refresh, setRefresh] = useState(0);
  const [editingEventId, setEditingEventId] = useState(null);

  // ustawienia powiadomień
  const [settingsModal, setSettingsModal] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [notifMinutes, setNotifMinutes] = useState(15);

  // confirm (usuwanie)
  const [confirmModal, setConfirmModal] = useState(false);
  const [confirmPayload, setConfirmPayload] = useState(null);

  // FIX 1: Custom alert modal – zastąpienie Alert.alert
  const [msgModal, setMsgModal] = useState(false);
  const [msgPayload, setMsgPayload] = useState({ t: '', m: '', isErr: false });

  const showMsg = (t, m, isErr = false) => {
    setMsgPayload({ t, m, isErr });
    setMsgModal(true);
  };

  useEffect(() => {
    (async () => {
      try { const t = await SecureStore.getItemAsync('calendary_token'); if (t) setToken(t); }
      catch { }
      finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const en = await SecureStore.getItemAsync('notif_enabled');
        const min = await SecureStore.getItemAsync('notif_minutes');
        if (en !== null) setNotifEnabled(en === 'true');
        if (min !== null) setNotifMinutes(parseInt(min, 10));
      } catch { }
    })();
  }, []);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const today = new Date();
        const from = new Date(today.getFullYear() - 1, 0, 1).toISOString();
        const to = new Date(today.getFullYear() + 2, 11, 31).toISOString();
        const { data } = await axios.get(`${API_URL}/events`, { params: { from, to }, headers: { Authorization: `Bearer ${token}` }, timeout: 10000 });
        const map = {};
        data.events.forEach(ev => {
          const d = new Date(ev.start_date);
          const localDay = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
          if (!map[localDay]) map[localDay] = [];
          map[localDay].push({ ...ev, _start: d, _end: ev.end_date ? new Date(ev.end_date) : null });
        });
        Object.keys(map).forEach(k => map[k].sort((a, b) => a._start - b._start));
        setEventsMap(map);
      } catch (err) { if (err.response?.status === 401) handleLogout(); }
    })();
    registerPush(token);
  }, [token, refresh]);

  const handleLogin = async () => {
    if (!email || !pass) return showMsg('Błąd', 'Uzupełnij wszystkie pola.', true);
    setAL(true);
    try {
      const { data } = await axios.post(`${API_URL}/auth/login`, { email: email.trim(), password: pass }, { timeout: 10000 });
      await SecureStore.setItemAsync('calendary_token', data.token);
      setToken(data.token);
    } catch (e) {
      if (e.code === 'ECONNABORTED') showMsg('Błąd', 'Serwer nie odpowiada (Przekroczono czas).', true);
      else showMsg('Błąd logowania', e.response?.data?.error || 'Sprawdź połączenie z internetem.', true);
    } finally { setAL(false); }
  };

  const handleRegister = async () => {
    if (!email || !pass) return showMsg('Błąd', 'Uzupełnij wszystkie pola.', true);
    if (pass.length < 8) return showMsg('Błąd', 'Hasło musi mieć min. 8 znaków.', true);
    if (pass !== confirmPass) return showMsg('Błąd', 'Hasła nie są zgodne.', true);
    setAL(true);
    try {
      const { data } = await axios.post(`${API_URL}/auth/register`, { email: email.trim(), password: pass }, { timeout: 10000 });
      await SecureStore.setItemAsync('calendary_token', data.token);
      setToken(data.token);
    } catch (e) {
      if (e.code === 'ECONNABORTED') showMsg('Błąd', 'Serwer nie odpowiada.', true);
      else showMsg('Błąd rejestracji', e.response?.data?.error || 'Błąd serwera. Spróbuj później.', true);
    } finally { setAL(false); }
  };

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync('calendary_token');
    setToken(null); setEventsMap({});
  };

  // FIX 1: Zamieniono Alert.alert -> showMsg
  const handleSaveEvent = async () => {
    if (!title.trim()) return showMsg('Błąd', 'Tytuł jest wymagany.', true);
    const parts = selectedDate.split('-');
    const build = (timeObj) => {
      const d = new Date(timeObj);
      const res = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), d.getHours(), d.getMinutes(), 0, 0);
      return res.toISOString();
    };
    const startISO = build(startTime);
    const endISO = hasEnd ? build(endTime) : null;

    try {
      if (editingEventId) {
        await axios.put(`${API_URL}/events/${editingEventId}`, { title: title.trim(), description: desc.trim(), start_date: startISO, end_date: endISO, color: selectedColor, recurrence }, { headers: { Authorization: `Bearer ${token}` } });
        if (notifEnabled) await scheduleNotification(title.trim(), startISO, notifMinutes);
      } else {
        await axios.post(`${API_URL}/events`, { title: title.trim(), description: desc.trim(), start_date: startISO, end_date: endISO, color: selectedColor, recurrence }, { headers: { Authorization: `Bearer ${token}` } });
        if (notifEnabled) await scheduleNotification(title.trim(), startISO, notifMinutes);
      }
      setModal(false); setTitle(''); setDesc(''); setHasEnd(false); setSelectedColor(COLORS[0]); setRecurrence('none'); setEditingEventId(null);
      setRefresh(p => p + 1);
    } catch (e) {
      console.log('Zapis eventu blad:', e.response?.data || e.message);
      showMsg('Błąd', 'Nie udało się zapisać: ' + (e.response?.data?.error || e.message), true);
    }
  };

  const handleDelete = (id, t, start_date, is_recurring, original_id) => {
    setConfirmPayload({ id, t, start_date, is_recurring, original_id: original_id || id });
    setConfirmModal(true);
  };

  const performDelete = async (type) => {
    const { id, start_date, original_id } = confirmPayload;
    try {
      if (type === 'instance') {
        const d = new Date(start_date);
        const dayStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        await axios.post(`${API_URL}/events/${original_id}/exclude`, { date: dayStr }, { headers: { Authorization: `Bearer ${token}` } });
      } else if (type === 'series' || type === 'single') {
        await axios.delete(`${API_URL}/events/${original_id || id}`, { headers: { Authorization: `Bearer ${token}` } });
      }
      setConfirmModal(false);
      setModal(false);
      setRefresh(p => p + 1);
    } catch {
      showMsg('Błąd', 'Nie udało się usunąć wydarzenia.', true);
    }
  };

  // FIX 2: Przepisany time picker – przyciski +/- zamiast ScrollView
  // Eliminuje problemy z zagnieżdżonymi ScrollView wewnątrz Modal
  // ── Wklej to zamiast całej funkcji TimePickerUI ──────────────────────────
// Potrzebujesz też: npm install react-native-svg


const TimePickerUI = () => {
  const curr = new Date(pickerFor === 'start' ? startTime : endTime);
  const [clockMode, setClockMode] = useState('h');
  const [tempH, setTempH] = useState(curr.getHours());
  const [tempM, setTempM] = useState(curr.getMinutes());
 
  const CLOCK_SIZE = 260;
  const CX = 130, CY = 130, R = 118, INNER_R = 78;
  const PAD = n => String(n).padStart(2, '0');
 
  const confirm = () => {
    const d = new Date(curr);
    d.setHours(tempH);
    d.setMinutes(tempM);
    if (pickerFor === 'start') setStart(d);
    else setEnd(d);
    setPicker(false);
  };
 
  const handleTouch = (x, y) => {
    const dx = x - CX, dy = y - CY;
    const angle = Math.atan2(dy, dx);
    const dist = Math.sqrt(dx * dx + dy * dy);
 
    if (clockMode === 'h') {
      // zewnętrzny pierścień: 1–12, wewnętrzny: 13–24 (0)
      let h = Math.round((angle + Math.PI / 2) / (2 * Math.PI) * 12);
      if (h <= 0) h += 12;
      const isInner = dist < (R * 0.55);
      if (isInner) {
        // 13–24, gdzie pozycja 12 = 0 (północ)
        setTempH(h === 12 ? 0 : h + 12);
      } else {
        setTempH(h);
      }
    } else {
      let m = Math.round((angle + Math.PI / 2) / (2 * Math.PI) * 60);
      if (m < 0) m += 60;
      m = Math.round(m / 5) * 5;
      if (m >= 60) m = 0;
      setTempM(m);
    }
  };
 
  const panResponder = React.useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      handleTouch(e.nativeEvent.locationX, e.nativeEvent.locationY);
    },
    onPanResponderMove: (e) => {
      handleTouch(e.nativeEvent.locationX, e.nativeEvent.locationY);
    },
    onPanResponderRelease: () => {
      if (clockMode === 'h') setClockMode('m');
    },
  }), [clockMode, tempH, tempM]);
 
  const renderHourLabels = () => {
    const nodes = [];
    // zewnętrzny: 1–12
    const outer = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    outer.forEach((h, i) => {
      const angle = (i / 12) * 2 * Math.PI - Math.PI / 2;
      const x = CX + R * 0.8 * Math.cos(angle);
      const y = CY + R * 0.8 * Math.sin(angle);
      const isActive = h === tempH;
      if (isActive) nodes.push(<Circle key={`oc${i}`} cx={x} cy={y} r={19} fill={C.accent} />);
      nodes.push(
        <SvgText key={`ot${i}`} x={x} y={y} textAnchor="middle" alignmentBaseline="central"
          fill={isActive ? '#fff' : C.text} fontSize={14} fontWeight="500">
          {PAD(h)}
        </SvgText>
      );
    });
 
    // wewnętrzny: 13–24 (gdzie 24 = pozycja 12 = godzina 0)
    const inner = [0, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
    inner.forEach((h, i) => {
      const angle = (i / 12) * 2 * Math.PI - Math.PI / 2;
      const x = CX + INNER_R * 0.65 * Math.cos(angle);
      const y = CY + INNER_R * 0.65 * Math.sin(angle);
      const isActive = h === tempH;
      const label = h === 0 ? '24' : PAD(h);
      if (isActive) nodes.push(<Circle key={`ic${i}`} cx={x} cy={y} r={17} fill={C.accent} />);
      nodes.push(
        <SvgText key={`it${i}`} x={x} y={y} textAnchor="middle" alignmentBaseline="central"
          fill={isActive ? '#fff' : C.sub} fontSize={12}>
          {label}
        </SvgText>
      );
    });
 
    // wskazówka
    const isInner = tempH === 0 || tempH >= 13;
    const ring = isInner ? INNER_R * 0.65 : R * 0.8;
    const idx = isInner
      ? (tempH === 0 ? 0 : tempH - 12)
      : (tempH === 12 ? 0 : tempH);
    const angle = (idx / 12) * 2 * Math.PI - Math.PI / 2;
    nodes.push(
      <Line key="hand"
        x1={CX} y1={CY}
        x2={CX + ring * Math.cos(angle)}
        y2={CY + ring * Math.sin(angle)}
        stroke={C.accent} strokeWidth={2} strokeLinecap="round" />
    );
    nodes.push(<Circle key="center" cx={CX} cy={CY} r={5} fill={C.accent} />);
    return nodes;
  };
 
  const renderMinuteLabels = () => {
    const nodes = [];
    for (let i = 0; i < 60; i++) {
      const angle = (i / 60) * 2 * Math.PI - Math.PI / 2;
      const x = CX + R * 0.8 * Math.cos(angle);
      const y = CY + R * 0.8 * Math.sin(angle);
      const isActive = i === tempM;
      const isQuint = i % 5 === 0;
      if (isActive) nodes.push(<Circle key={`mc${i}`} cx={x} cy={y} r={19} fill={C.accent} />);
      if (isQuint) {
        nodes.push(
          <SvgText key={`mt${i}`} x={x} y={y} textAnchor="middle" alignmentBaseline="central"
            fill={isActive ? '#fff' : C.text} fontSize={13} fontWeight="500">
            {PAD(i)}
          </SvgText>
        );
      }
    }
    const angle = (tempM / 60) * 2 * Math.PI - Math.PI / 2;
    nodes.push(
      <Line key="hand"
        x1={CX} y1={CY}
        x2={CX + R * 0.8 * Math.cos(angle)}
        y2={CY + R * 0.8 * Math.sin(angle)}
        stroke={C.accent} strokeWidth={2} strokeLinecap="round" />
    );
    nodes.push(<Circle key="center" cx={CX} cy={CY} r={5} fill={C.accent} />);
    return nodes;
  };
 
  return (
    <View style={{ paddingVertical: 12, alignItems: 'center' }}>
 
      {/* Przełącznik trybu */}
      <View style={{
        flexDirection: 'row', borderWidth: 1, borderColor: C.border,
        borderRadius: 10, overflow: 'hidden', marginBottom: 16,
      }}>
        {[['h', 'Godzina'], ['m', 'Minuty']].map(([val, lbl]) => (
          <TouchableOpacity key={val} onPress={() => setClockMode(val)}
            style={{
              paddingHorizontal: 28, paddingVertical: 9,
              backgroundColor: clockMode === val ? C.accentDim : 'transparent',
            }}>
            <Text style={{ color: clockMode === val ? C.accent : C.sub, fontWeight: '600', fontSize: 13 }}>
              {lbl}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
 
      {/* Wyświetlacz czasu */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 20, gap: 4 }}>
        <TouchableOpacity
          onPress={() => setClockMode('h')}
          style={{
            paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
            backgroundColor: clockMode === 'h' ? C.accentDim : 'transparent',
          }}>
          <Text style={{ fontSize: 52, fontWeight: '700', color: clockMode === 'h' ? C.accent : C.text, lineHeight: 58 }}>
            {PAD(tempH)}
          </Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 48, fontWeight: '300', color: C.sub, lineHeight: 58 }}>:</Text>
        <TouchableOpacity
          onPress={() => setClockMode('m')}
          style={{
            paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
            backgroundColor: clockMode === 'm' ? C.accentDim : 'transparent',
          }}>
          <Text style={{ fontSize: 52, fontWeight: '700', color: clockMode === 'm' ? C.accent : C.text, lineHeight: 58 }}>
            {PAD(tempM)}
          </Text>
        </TouchableOpacity>
      </View>
 
      {/* Tarcza */}
      <View {...panResponder.panHandlers} style={{ width: CLOCK_SIZE, height: CLOCK_SIZE }}>
        <Svg width={CLOCK_SIZE} height={CLOCK_SIZE}>
          <Circle cx={CX} cy={CY} r={R} fill={C.surface} />
          {clockMode === 'h' ? renderHourLabels() : renderMinuteLabels()}
        </Svg>
      </View>
 
      {/* Zatwierdź */}
      <TouchableOpacity
        onPress={confirm}
        style={[s.saveBtn, { marginTop: 16, width: '80%', height: 50, borderRadius: 12 }]}>
        <Text style={s.saveTxt}>ZATWIERDŹ</Text>
      </TouchableOpacity>
    </View>
  );
};

  const localSelected = new Date(selectedDate);
  const selectedLocalKey = localSelected.getFullYear() + '-' + String(localSelected.getMonth() + 1).padStart(2, '0') + '-' + String(localSelected.getDate()).padStart(2, '0');

  const markedDates = Object.keys(eventsMap).reduce((acc, d) => ({ ...acc, [d]: { marked: true, dotColor: eventsMap[d][0]?.color || C.accent } }), {});
  markedDates[selectedLocalKey] = { ...(markedDates[selectedLocalKey] || {}), selected: true, selectedColor: C.accent };

  const dayEvents = eventsMap[selectedLocalKey] || [];

  const upcomingEvents = useMemo(() => {
    const dzisiajMidnight = new Date();
    dzisiajMidnight.setHours(0, 0, 0, 0);
    const flattened = Object.values(eventsMap).flat();
    return flattened
      .filter(e => e._start >= dzisiajMidnight)
      .sort((a, b) => a._start - b._start);
  }, [eventsMap]);

  const EventCardRender = ({ item }) => (
    <TouchableOpacity style={s.eventCard}
      onPress={() => {
        setEditingEventId(item.original_id || item.id);
        setSelectedDate(item.start_date.split('T')[0]);
        setTitle(item.title);
        setDesc(item.description || '');
        setStart(item._start);
        setHasEnd(!!item._end);
        setEnd(item._end || item._start);
        setSelectedColor(item.color || COLORS[0]);
        setRecurrence(item.recurrence || 'none');
        setModal(true);
      }}
      onLongPress={() => handleDelete(item.id, item.title, item.start_date, item.is_recurring, item.original_id || item.id)}
      activeOpacity={0.75}
    >
      <View style={[s.eventStripe, { backgroundColor: item.color || C.accent }]} />
      <View style={s.eventContent}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
          <Text style={s.eventTime}>{fmt(item._start)}{item._end ? ` – ${fmt(item._end)}` : ''}</Text>
          <Text style={s.eventDateSmall}>{fmtDateShort(item._start)}</Text>
        </View>
        <Text style={s.eventTitle} numberOfLines={1}>{item.title}</Text>
        {item.description ? <Text style={s.eventDesc} numberOfLines={2}>{item.description}</Text> : null}
      </View>
    </TouchableOpacity>
  );

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator size="large" color={C.accent} />
    </View>
  );

  // ══ AUTH ═════════════════════════════════════════════════════════════════
  if (!token) return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.authScroll} keyboardShouldPersistTaps="handled">
          <View style={s.logoBlock}>
            <View style={s.logoMark}>
              <View style={s.logoMarkDot} />
              <View style={[s.logoMarkDot, { height: 2, width: 12, marginTop: 4 }]} />
              <View style={[s.logoMarkDot, { height: 2, width: 8, marginTop: 3 }]} />
            </View>
            <Text style={s.logoTitle}>Calendary</Text>
            <Text style={s.logoSub}>Twój inteligentny kalendarz</Text>
          </View>
          <View style={s.tabs}>
            {['login', 'register'].map(t => (
              <TouchableOpacity key={t} style={[s.tab, authTab === t && s.tabActive]}
                onPress={() => { setAuthTab(t); setConf(''); }} activeOpacity={0.8}>
                <Text style={[s.tabTxt, authTab === t && s.tabTxtActive]}>
                  {t === 'login' ? 'Logowanie' : 'Rejestracja'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={s.authCard}>
            <Text style={s.fieldLbl}>ADRES E-MAIL</Text>
            <TextInput style={s.input} placeholder="ty@example.com" placeholderTextColor={C.muted}
              keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
            <Text style={s.fieldLbl}>HASŁO</Text>
            <TextInput style={s.input} placeholder={authTab === 'register' ? 'Minimum 8 znaków' : '••••••••'}
              placeholderTextColor={C.muted} secureTextEntry value={pass} onChangeText={setPass} />
            {authTab === 'register' && <>
              <Text style={s.fieldLbl}>POWTÓRZ HASŁO</Text>
              <TextInput style={s.input} placeholder="Powtórz hasło" placeholderTextColor={C.muted} secureTextEntry value={confirmPass} onChangeText={setConf} />
            </>}
            <TouchableOpacity style={s.submitBtn} onPress={authTab === 'login' ? handleLogin : handleRegister} disabled={authLoading}>
              {authLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.submitTxt}>{authTab === 'login' ? 'Zaloguj się' : 'Utwórz konto'}</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* FIX 1: Alert modal dostępny też na ekranie auth */}
      <Modal animationType="fade" transparent visible={msgModal} onRequestClose={() => setMsgModal(false)}>
        <View style={[s.sheetOverlay, { backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 30 }]}>
          <View style={{ backgroundColor: C.card, borderRadius: 28, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: C.border }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: msgPayload.isErr ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 32 }}>{msgPayload.isErr ? '⚠️' : '✅'}</Text>
            </View>
            <Text style={{ color: C.text, fontSize: 20, fontWeight: '700', marginBottom: 10, textAlign: 'center' }}>{msgPayload.t}</Text>
            <Text style={{ color: C.sub, fontSize: 15, textAlign: 'center', marginBottom: 28, paddingHorizontal: 15, lineHeight: 22 }}>{msgPayload.m}</Text>
            <TouchableOpacity
              style={{ width: '100%', height: 56, borderRadius: 14, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}
              onPress={() => setMsgModal(false)}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>ROZUMIEM</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );

  // ══ MAIN ══════════════════════════════════════════════════════════════════
  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Calendary</Text>
          <Text style={s.headerSub}>{new Date().toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity onPress={() => setSettingsModal(true)} style={s.settingsBtn}>
            <Text style={s.settingsTxt}>⚙️</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={s.logoutBtn}>
            <Text style={s.logoutTxt}>Wyloguj</Text>
          </TouchableOpacity>
        </View>
      </View>

      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{
            tabBarActiveTintColor: C.accent,
            tabBarInactiveTintColor: C.sub,
            tabBarIndicatorStyle: { backgroundColor: C.accent, height: 3, borderRadius: 3 },
            tabBarStyle: { backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
            tabBarLabelStyle: { fontSize: 13, fontWeight: '700', textTransform: 'none' },
          }}
        >
          <Tab.Screen name="Calendar" options={{ tabBarLabel: 'Kalendarz' }}>
            {() => (
              <View style={s.listWrap}>
                <Calendar
                  current={selectedDate}
                  onDayPress={d => setSelectedDate(d.dateString)}
                  markedDates={markedDates}
                  theme={calTheme}
                  style={s.cal}
                  enableSwipeMonths
                />
                <View style={s.listHeader}>
                  <Text style={s.listDateTxt} numberOfLines={1}>{formatDate(selectedDate)}</Text>
                  <View style={s.badge}><Text style={s.badgeTxt}>{dayEvents.length}</Text></View>
                </View>
                {dayEvents.length === 0
                  ? <Text style={s.empty}>Brak wydarzeń w tym dniu</Text>
                  : <FlatList
                    data={dayEvents}
                    keyExtractor={i => i.id.toString()}
                    contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => <EventCardRender item={item} />}
                  />
                }
              </View>
            )}
          </Tab.Screen>

          <Tab.Screen name="Agenda" options={{ tabBarLabel: 'Wszystkie nadchodzące' }}>
            {() => (
              <View style={s.listWrap}>
                {upcomingEvents.length === 0
                  ? <Text style={s.empty}>Brak nadchodzących wydarzeń</Text>
                  : <FlatList
                    data={upcomingEvents}
                    keyExtractor={i => i.id.toString()}
                    contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => <EventCardRender item={item} />}
                  />
                }
              </View>
            )}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>

      <TouchableOpacity style={s.fabCentered} onPress={() => {
        setEditingEventId(null); setTitle(''); setDesc(''); setHasEnd(false);
        setStart(new Date()); setEnd(new Date()); setSelectedColor(COLORS[0]);
        setModal(true);
      }} activeOpacity={0.88}>
        <View style={s.fabIconWrap}>
          <Text style={s.fabTxt}>+</Text>
        </View>
      </TouchableOpacity>

      {/* ── Modal Edycji/Dodawania ── */}
      <Modal animationType="slide" transparent visible={modal} onRequestClose={() => setModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.sheetOverlay}>
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>{editingEventId ? 'Edytuj wydarzenie' : 'Nowe wydarzenie'}</Text>
              <TouchableOpacity onPress={() => setModal(false)} style={s.closeBtn}>
                <Text style={s.closeTxt}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.sheetSub}>{formatDate(selectedDate)}</Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ flexShrink: 1 }} nestedScrollEnabled>
              <Text style={s.fieldLbl}>TYTUŁ</Text>
              <TextInput style={s.input} placeholder="Nazwa wydarzenia" placeholderTextColor={C.muted} value={title} onChangeText={setTitle} />
              <Text style={s.fieldLbl}>NOTATKA (OPCJONALNIE)</Text>
              <TextInput style={[s.input, { height: 72, textAlignVertical: 'top' }]} placeholder="Szczegóły..." placeholderTextColor={C.muted} multiline value={desc} onChangeText={setDesc} />
              <Text style={s.fieldLbl}>KOLOR WYDARZENIA</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                {COLORS.map(c => (
                  <TouchableOpacity key={c} onPress={() => setSelectedColor(c)} style={[{ width: 34, height: 34, borderRadius: 17, backgroundColor: c }, selectedColor === c && { borderWidth: 3, borderColor: C.text }]} />
                ))}
              </View>

              <Text style={s.fieldLbl}>CYKLICZNOŚĆ</Text>
              <View style={{ marginBottom: 12 }}>
                {RECURRENCE_OPTIONS.map(opt => (
                  <TouchableOpacity key={opt.value} style={[s.notifOption, recurrence === opt.value && s.notifOptionActive]} onPress={() => setRecurrence(opt.value)}>
                    <Text style={[s.notifOptionTxt, recurrence === opt.value && s.notifOptionTxtActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.fieldLbl}>GODZINA ROZPOCZĘCIA</Text>
              <TouchableOpacity style={[s.timeRow, picker && pickerFor === 'start' && s.notifOptionActive]} onPress={() => { setPickerFor('start'); setPicker(prev => (pickerFor === 'start' ? !prev : true)); }}>
                <Text style={s.timeRowLabel}>Rozpoczęcie</Text>
                <Text style={s.timeRowValue}>{fmt(startTime)}</Text>
              </TouchableOpacity>
              {picker && pickerFor === 'start' && <TimePickerUI />}

              <View style={s.switchRow}>
                <Text style={s.switchLbl}>Godzina zakończenia</Text>
                <Switch value={hasEnd} onValueChange={setHasEnd} trackColor={{ false: C.muted, true: C.accent }} thumbColor="#fff" />
              </View>
              {hasEnd && (
                <>
                  <TouchableOpacity style={[s.timeRow, picker && pickerFor === 'end' && s.notifOptionActive]} onPress={() => { setPickerFor('end'); setPicker(prev => (pickerFor === 'end' ? !prev : true)); }}>
                    <Text style={s.timeRowLabel}>Zakończenie</Text>
                    <Text style={s.timeRowValue}>{fmt(endTime)}</Text>
                  </TouchableOpacity>
                  {picker && pickerFor === 'end' && <TimePickerUI />}
                </>
              )}
            </ScrollView>

            <View style={s.sheetBtns}>
              {editingEventId && (
                <TouchableOpacity style={s.cancelBtn} onPress={() => { setModal(false); handleDelete(editingEventId, title, startTime.toISOString(), recurrence !== 'none', editingEventId); }}>
                  <Text style={[s.cancelTxt, { color: C.danger }]}>Usuń</Text>
                </TouchableOpacity>
              )}
              {!editingEventId && (
                <TouchableOpacity style={s.cancelBtn} onPress={() => setModal(false)}>
                  <Text style={s.cancelTxt}>Anuluj</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={s.saveBtn} onPress={handleSaveEvent}>
                <Text style={s.saveTxt}>Zapisz</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Settings Modal ── */}
      <Modal animationType="slide" transparent visible={settingsModal} onRequestClose={() => setSettingsModal(false)}>
        <View style={s.sheetOverlay}>
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Ustawienia powiadomień</Text>
              <TouchableOpacity onPress={() => setSettingsModal(false)} style={s.closeBtn}>
                <Text style={s.closeTxt}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={s.switchRow}>
              <Text style={s.switchLbl}>Włącz powiadomienia</Text>
              <Switch value={notifEnabled} onValueChange={async (v) => { setNotifEnabled(v); await SecureStore.setItemAsync('notif_enabled', String(v)); }} trackColor={{ false: C.muted, true: C.accent }} thumbColor="#fff" />
            </View>
            {notifEnabled && (
              <>
                <Text style={[s.fieldLbl, { marginTop: 14, marginBottom: 10 }]}>CZAS PRZED WYDARZENIEM</Text>
                {NOTIF_OPTIONS.map(opt => (
                  <TouchableOpacity key={opt.value} style={[s.notifOption, notifMinutes === opt.value && s.notifOptionActive]} onPress={async () => { setNotifMinutes(opt.value); await SecureStore.setItemAsync('notif_minutes', String(opt.value)); }} activeOpacity={0.75}>
                    <Text style={[s.notifOptionTxt, notifMinutes === opt.value && s.notifOptionTxtActive]}>{opt.label}</Text>
                    {notifMinutes === opt.value && <Text style={{ color: C.accent, fontWeight: '700' }}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── FIX 3: Deletion Modal – naprawiony layout tekstu ── */}
      <Modal animationType="fade" transparent visible={confirmModal} onRequestClose={() => setConfirmModal(false)}>
        <View style={[s.sheetOverlay, { backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 25 }]}>
          <View style={{
            backgroundColor: C.card,
            borderRadius: 24,
            padding: 24,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: C.border,
            width: '100%',
          }}>
            {/* Ikona */}
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(239,68,68,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 28 }}>🗑️</Text>
            </View>

            {/* Tytuł */}
            <Text style={{ color: C.text, fontSize: 18, fontWeight: '800', marginBottom: 8, textAlign: 'center' }}>
              USUNĄĆ WYDARZENIE?
            </Text>

            {/* Opis */}
            <Text style={{ color: C.sub, fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>
              {confirmPayload?.is_recurring
                ? 'To wydarzenie jest cykliczne. Wybierz zakres usuwania:'
                : `Czy na pewno chcesz usunąć "${confirmPayload?.t}"? Tej akcji nie cofniesz.`}
            </Text>

            {/* Przyciski – FIX: usunięto flex z s.saveBtn, zastąpiono explicit width */}
            <View style={{ width: '100%', gap: 12 }}>
              {confirmPayload?.is_recurring ? (
                <>
                  <TouchableOpacity
                    style={{ width: '100%', height: 56, borderRadius: 14, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center' }}
                    onPress={() => performDelete('instance')}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800' }}>TYLKO TO WYSTĄPIENIE</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ width: '100%', height: 56, borderRadius: 14, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center' }}
                    onPress={() => performDelete('series')}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800' }}>USUŃ CAŁĄ SERIĘ</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={{ width: '100%', height: 56, borderRadius: 14, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => performDelete('single')}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800' }}>USUŃ TERAZ</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={{ width: '100%', height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: C.border, marginTop: 4 }}
                onPress={() => setConfirmModal(false)}
                activeOpacity={0.7}
              >
                <Text style={{ color: C.sub, fontSize: 15, fontWeight: '700' }}>Anuluj</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── FIX 1: Custom Alert/Message Modal ── */}
      <Modal animationType="fade" transparent visible={msgModal} onRequestClose={() => setMsgModal(false)}>
        <View style={[s.sheetOverlay, { backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 30 }]}>
          <View style={{ backgroundColor: C.card, borderRadius: 28, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: C.border }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: msgPayload.isErr ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 32 }}>{msgPayload.isErr ? '⚠️' : '✅'}</Text>
            </View>
            <Text style={{ color: C.text, fontSize: 20, fontWeight: '700', marginBottom: 10, textAlign: 'center' }}>{msgPayload.t}</Text>
            <Text style={{ color: C.sub, fontSize: 15, textAlign: 'center', marginBottom: 28, paddingHorizontal: 15, lineHeight: 22 }}>{msgPayload.m}</Text>
            <TouchableOpacity
              style={{ width: '100%', height: 56, borderRadius: 14, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}
              onPress={() => setMsgModal(false)}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>ROZUMIEM</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (C) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },

  // auth
  authScroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoBlock: { alignItems: 'center', marginBottom: 40 },
  logoMark: { width: 52, height: 52, borderRadius: 14, backgroundColor: C.accent, justifyContent: 'center', alignItems: 'center', shadowColor: C.accent, shadowOpacity: 0.5, shadowRadius: 16, elevation: 6, marginBottom: 16 },
  logoMarkDot: { width: 24, height: 3, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 2 },
  logoTitle: { fontSize: 26, fontWeight: '800', color: C.text, letterSpacing: -0.5, marginBottom: 4 },
  logoSub: { fontSize: 13, color: C.sub },
  tabs: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: 3, marginBottom: 20, gap: 3, borderWidth: 1, borderColor: C.border },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  tabActive: { backgroundColor: C.accent, shadowColor: C.accent, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4 },
  tabTxt: { color: C.sub, fontWeight: '600', fontSize: 13 },
  tabTxtActive: { color: '#fff' },
  authCard: { backgroundColor: C.card, borderRadius: 14, padding: 20, borderWidth: 1, borderColor: C.border },
  fieldLbl: { color: C.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginBottom: 6, marginTop: 2 },
  input: { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: C.border, borderRadius: 9, color: C.text, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, marginBottom: 14 },
  submitBtn: { backgroundColor: C.accent, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 4, shadowColor: C.accent, shadowOpacity: 0.35, shadowRadius: 10, elevation: 4 },
  submitTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12, backgroundColor: C.surface },
  headerTitle: { color: C.text, fontSize: 17, fontWeight: '700' },
  headerSub: { color: C.sub, fontSize: 12, marginTop: 1, textTransform: 'capitalize' },
  logoutBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: 'rgba(255,255,255,0.03)' },
  logoutTxt: { color: C.sub, fontSize: 12, fontWeight: '600' },

  // calendar
  cal: { borderBottomWidth: 1, borderBottomColor: C.border },

  // list
  listWrap: { flex: 1, backgroundColor: C.bg },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 11, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  listDateTxt: { color: C.sub, fontSize: 12, fontWeight: '600', textTransform: 'capitalize', flex: 1 },
  badge: { backgroundColor: C.accentDim, borderRadius: 20, minWidth: 26, height: 26, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  badgeTxt: { color: C.accent, fontWeight: '700', fontSize: 12 },
  empty: { textAlign: 'center', color: C.muted, fontSize: 13, marginTop: 32 },

  eventCard: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  eventStripe: { width: 4 },
  eventContent: { flex: 1, padding: 14 },
  eventTime: { color: C.accent, fontSize: 12, fontWeight: '700' },
  eventDateSmall: { color: C.sub, fontSize: 11, fontWeight: '600' },
  eventTitle: { color: C.text, fontSize: 15, fontWeight: '600', marginTop: 2, marginBottom: 3 },
  eventDesc: { color: '#94a3b8', fontSize: 13 },

  // FAB
  fabCentered: {
    position: 'absolute', bottom: 85, right: 25,
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: C.accent,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: C.accent, shadowOpacity: 0.6, shadowRadius: 15, elevation: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  fabIconWrap: { justifyContent: 'center', alignItems: 'center' },
  fabTxt: { fontSize: 32, color: '#fff', fontWeight: '300', lineHeight: 36, textAlign: 'center' },

  // sheet
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 20, borderTopWidth: 1, borderColor: 'rgba(99,102,241,0.2)', maxHeight: '88%' },
  sheetHandle: { width: 36, height: 4, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  sheetTitle: { color: C.text, fontSize: 16, fontWeight: '700' },
  sheetSub: { color: C.sub, fontSize: 12, marginBottom: 18, textTransform: 'capitalize' },
  closeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  closeTxt: { color: C.sub, fontSize: 13 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 9, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  timeRowLabel: { color: C.sub, fontSize: 13 },
  timeRowValue: { color: C.accent, fontSize: 17, fontWeight: '700' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 9, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  switchLbl: { color: C.sub, fontSize: 13 },
  sheetBtns: { flexDirection: 'row', gap: 10, marginTop: 12 },
  cancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: C.border, backgroundColor: 'rgba(255,255,255,0.03)' },
  cancelTxt: { color: C.sub, fontWeight: '600', fontSize: 14 },
  // FIX: saveBtn nie ma już flex:2 w globalnym stylu – ma go tylko w sheetBtns kontekście
  saveBtn: { flex: 2, paddingVertical: 13, borderRadius: 10, alignItems: 'center', backgroundColor: C.accent, shadowColor: C.accent, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4 },
  saveTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // settings
  settingsBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: 'rgba(255,255,255,0.03)' },
  settingsTxt: { fontSize: 15 },
  notifOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 9, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  notifOptionActive: { borderColor: C.accent, backgroundColor: C.accentDim },
  notifOptionTxt: { color: C.sub, fontSize: 13 },
  notifOptionTxtActive: { color: C.accent, fontWeight: '600' },

  // FIX 2: Time Picker Spinner styles
  timePickerContainer: {
    padding: 16,
    borderRadius: 20,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: C.border,
  },
  spinnerArrow: {
    width: '100%',
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  spinnerArrowTxt: {
    color: C.accent,
    fontSize: 18,
    fontWeight: '700',
  },
  spinnerValueBox: {
    width: '100%',
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
    backgroundColor: C.accentDim,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.accent,
  },
  spinnerValueTxt: {
    color: C.text,
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1,
  },
  timeSeparator: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 32,
  },
  timeSeparatorTxt: {
    color: C.accent,
    fontSize: 36,
    fontWeight: '800',
  },
});