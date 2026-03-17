import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, StatusBar, KeyboardAvoidingView,
  Platform, FlatList, Modal, Switch, ScrollView, SafeAreaView
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

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

// Paleta kolorów
const C = {
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
};

const calTheme = {
  calendarBackground: C.surface,
  textSectionTitleColor: C.sub,
  selectedDayBackgroundColor: C.accent,
  selectedDayTextColor: '#fff',
  todayTextColor: C.accent,
  todayBackgroundColor: C.accentDim,
  dayTextColor: C.text,
  textDisabledColor: '#1f2937',
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

const COLORS = [C.accent, '#ef4444', '#10b981', '#f59e0b', '#3b82f6', '#ec4899'];

async function scheduleNotification(title, startISO, minutes = 15) {
  const trigger = new Date(startISO);
  trigger.setMinutes(trigger.getMinutes() - minutes);
  if (trigger <= new Date()) return;
  const bodyLabel = minutes === 0
    ? `Teraz: ${title}`
    : `Za ${minutes < 60 ? `${minutes} min` : minutes === 1440 ? '1 dzień' : `${minutes / 60}h`}: ${title}`;
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Przypomnienie – Calendary', body: bodyLabel, sound: true },
    trigger,
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
  } catch (e) { console.log('push (ignorowane w Expo Go):', e.message); }
}

const fmt = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

const formatDate = (iso) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });

// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
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
  const [refresh, setRefresh] = useState(0);
  const [editingEventId, setEditingEventId] = useState(null);

  // ustawienia powiadomień
  const [settingsModal, setSettingsModal] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [notifMinutes, setNotifMinutes] = useState(15);

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
        const to = new Date(today.getFullYear() + 1, 11, 31).toISOString();
        const { data } = await axios.get(`${API_URL}/events`, { params: { from, to }, headers: { Authorization: `Bearer ${token}` }, timeout: 10000 });
        const map = {};
        data.events.forEach(ev => {
          const day = ev.start_date.split('T')[0];
          if (!map[day]) map[day] = [];
          map[day].push({ ...ev, _start: new Date(ev.start_date), _end: ev.end_date ? new Date(ev.end_date) : null });
        });
        Object.keys(map).forEach(k => map[k].sort((a, b) => a._start - b._start));
        setEventsMap(map);
      } catch (err) { if (err.response?.status === 401) handleLogout(); }
    })();
    registerPush(token);
  }, [token, refresh]);

  const handleLogin = async () => {
    if (!email || !pass) return Alert.alert('Błąd', 'Uzupełnij wszystkie pola.');
    setAL(true);
    try {
      const { data } = await axios.post(`${API_URL}/auth/login`, { email: email.trim(), password: pass }, { timeout: 10000 });
      await SecureStore.setItemAsync('calendary_token', data.token);
      setToken(data.token);
    } catch (e) {
      if (e.code === 'ECONNABORTED') Alert.alert('Błąd', 'Serwer nie odpowiada (timeout). Sprawdź połączenie.');
      else Alert.alert('Błąd logowania', e.response?.data?.error || 'Brak połączenia z serwerem.');
    }
    finally { setAL(false); }
  };

  const handleRegister = async () => {
    if (!email || !pass) return Alert.alert('Błąd', 'Uzupełnij wszystkie pola.');
    if (pass.length < 8) return Alert.alert('Błąd', 'Hasło musi mieć min. 8 znaków.');
    if (pass !== confirmPass) return Alert.alert('Błąd', 'Hasła nie są zgodne.');
    setAL(true);
    try {
      const { data } = await axios.post(`${API_URL}/auth/register`, { email: email.trim(), password: pass }, { timeout: 10000 });
      await SecureStore.setItemAsync('calendary_token', data.token);
      setToken(data.token);
    } catch (e) {
      if (e.code === 'ECONNABORTED') Alert.alert('Błąd', 'Serwer nie odpowiada (timeout). Sprawdź połączenie.');
      else Alert.alert('Błąd rejestracji', e.response?.data?.error || 'Brak połączenia z serwerem.');
    }
    finally { setAL(false); }
  };

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync('calendary_token');
    setToken(null); setEventsMap({});
  };

  const handleSaveEvent = async () => {
    if (!title.trim()) return Alert.alert('Błąd', 'Tytuł jest wymagany.');
    const parts = selectedDate.split('-');
    const build = (t) => { const d = new Date(t); d.setFullYear(+parts[0], +parts[1] - 1, +parts[2]); return d.toISOString(); };
    const startISO = build(startTime);
    const endISO = hasEnd ? build(endTime) : null;
    try {
      if (editingEventId) {
        await axios.put(`${API_URL}/events/${editingEventId}`, { title: title.trim(), description: desc.trim(), start_date: startISO, end_date: endISO, color: selectedColor }, { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 });
        if (notifEnabled) await scheduleNotification(title.trim(), startISO, notifMinutes);
        Alert.alert('Zapisano', 'Wydarzenie zostało zaktualizowane.');
      } else {
        await axios.post(`${API_URL}/events`, { title: title.trim(), description: desc.trim(), start_date: startISO, end_date: endISO, color: selectedColor }, { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 });
        if (notifEnabled) await scheduleNotification(title.trim(), startISO, notifMinutes);
        Alert.alert('Zapisano', 'Wydarzenie zostało dodane.');
      }
      setModal(false); setTitle(''); setDesc(''); setHasEnd(false); setSelectedColor(COLORS[0]); setEditingEventId(null);
      setRefresh(p => p + 1);
    } catch { Alert.alert('Błąd', 'Nie udało się zapisać.'); }
  };

  const handleDelete = (id, t) =>
    Alert.alert('Usuń', `Usunąć "${t}"?`, [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Usuń', style: 'destructive', onPress: async () => {
          try { await axios.delete(`${API_URL}/events/${id}`, { headers: { Authorization: `Bearer ${token}` } }); setRefresh(p => p + 1); }
          catch { Alert.alert('Błąd', 'Nie udało się usunąć.'); }
        }
      },
    ]);

  const onTime = (e, v) => { setPicker(false); if (v) { if (pickerFor === 'start') setStart(v); else setEnd(v); } };

  const markedDates = Object.keys(eventsMap).reduce((acc, d) => ({ ...acc, [d]: { marked: true, dotColor: eventsMap[d][0]?.color || C.accent } }), {});
  markedDates[selectedDate] = { ...(markedDates[selectedDate] || {}), selected: true, selectedColor: C.accent };

  const dayEvents = eventsMap[selectedDate] || [];

  // ── Loading ──────────────────────────────────────────────────────────────
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

          {/* Logo block */}
          <View style={s.logoBlock}>
            <View style={s.logoMark}>
              <View style={s.logoMarkDot} />
              <View style={[s.logoMarkDot, { height: 2, width: 12, marginTop: 4 }]} />
              <View style={[s.logoMarkDot, { height: 2, width: 8, marginTop: 3 }]} />
            </View>
            <Text style={s.logoTitle}>Calendary</Text>
            <Text style={s.logoSub}>Twój inteligentny kalendarz</Text>
          </View>

          {/* Tabs */}
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

          {/* Formularz */}
          <View style={s.authCard}>
            <Text style={s.fieldLbl}>ADRES E-MAIL</Text>
            <TextInput style={s.input} placeholder="ty@example.com" placeholderTextColor={C.muted}
              keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />

            <Text style={s.fieldLbl}>HASŁO</Text>
            <TextInput style={s.input} placeholder={authTab === 'register' ? 'Minimum 8 znaków' : '••••••••'}
              placeholderTextColor={C.muted} secureTextEntry value={pass} onChangeText={setPass} />

            {authTab === 'register' && <>
              <Text style={s.fieldLbl}>POWTÓRZ HASŁO</Text>
              <TextInput style={s.input} placeholder="Powtórz hasło"
                placeholderTextColor={C.muted} secureTextEntry value={confirmPass} onChangeText={setConf} />
            </>}

            <TouchableOpacity style={s.submitBtn}
              onPress={authTab === 'login' ? handleLogin : handleRegister}
              disabled={authLoading} activeOpacity={0.85}>
              {authLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.submitTxt}>{authTab === 'login' ? 'Zaloguj się' : 'Utwórz konto'}</Text>
              }
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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

      {/* Kalendarz */}
      <Calendar
        current={selectedDate}
        onDayPress={d => setSelectedDate(d.dateString)}
        markedDates={markedDates}
        theme={calTheme}
        style={s.cal}
        enableSwipeMonths
      />

      {/* Lista */}
      <View style={s.listWrap}>
        <View style={s.listHeader}>
          <Text style={s.listDateTxt} numberOfLines={1}>{formatDate(selectedDate)}</Text>
          <View style={s.badge}><Text style={s.badgeTxt}>{dayEvents.length}</Text></View>
        </View>

        {dayEvents.length === 0
          ? <Text style={s.empty}>Brak wydarzeń w tym dniu</Text>
          : <FlatList
            data={dayEvents}
            keyExtractor={i => i.id.toString()}
            contentContainerStyle={{ padding: 12, paddingBottom: 80 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity style={s.eventCard}
                onPress={() => {
                  setEditingEventId(item.id);
                  setTitle(item.title);
                  setDesc(item.description || '');
                  setStart(item._start);
                  setHasEnd(!!item._end);
                  setEnd(item._end || item._start);
                  setSelectedColor(item.color || C.accent);
                  setModal(true);
                }}
                onLongPress={() => handleDelete(item.id, item.title)}
                activeOpacity={0.75}
              >
                <View style={[s.eventStripe, { backgroundColor: item.color || C.accent }]} />
                <View style={s.eventContent}>
                  <Text style={s.eventTime}>{fmt(item._start)}{item._end ? ` – ${fmt(item._end)}` : ''}</Text>
                  <Text style={s.eventTitle} numberOfLines={1}>{item.title}</Text>
                  {item.description ? <Text style={s.eventDesc} numberOfLines={1}>{item.description}</Text> : null}
                </View>
              </TouchableOpacity>
            )}
          />
        }
      </View>

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={() => {
        setEditingEventId(null); setTitle(''); setDesc(''); setHasEnd(false); 
        setStart(new Date()); setEnd(new Date()); setSelectedColor(COLORS[0]); 
        setModal(true); 
      }} activeOpacity={0.85}>
        <Text style={s.fabTxt}>+</Text>
      </TouchableOpacity>

      {/* ── Modal ── */}
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

            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              <Text style={s.fieldLbl}>TYTUŁ</Text>
              <TextInput style={s.input} placeholder="Nazwa wydarzenia" placeholderTextColor={C.muted}
                value={title} onChangeText={setTitle} />

              <Text style={s.fieldLbl}>NOTATKA (OPCJONALNIE)</Text>
              <TextInput style={[s.input, { height: 72, textAlignVertical: 'top' }]}
                placeholder="Szczegóły..." placeholderTextColor={C.muted} multiline
                value={desc} onChangeText={setDesc} />

              <Text style={s.fieldLbl}>KOLOR WYDARZENIA</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                {COLORS.map(c => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setSelectedColor(c)}
                    style={[
                      { width: 34, height: 34, borderRadius: 17, backgroundColor: c },
                      selectedColor === c && { borderWidth: 3, borderColor: '#fff' }
                    ]}
                  />
                ))}
              </View>

              <Text style={s.fieldLbl}>GODZINA ROZPOCZĘCIA</Text>
              <TouchableOpacity style={s.timeRow} onPress={() => { setPickerFor('start'); setPicker(true); }}>
                <Text style={s.timeRowLabel}>Rozpoczęcie</Text>
                <Text style={s.timeRowValue}>{fmt(startTime)}</Text>
              </TouchableOpacity>

              <View style={s.switchRow}>
                <Text style={s.switchLbl}>Godzina zakończenia</Text>
                <Switch value={hasEnd} onValueChange={setHasEnd}
                  trackColor={{ false: C.muted, true: C.accent }}
                  thumbColor="#fff"
                />
              </View>

              {hasEnd && (
                <TouchableOpacity style={s.timeRow} onPress={() => { setPickerFor('end'); setPicker(true); }}>
                  <Text style={s.timeRowLabel}>Zakończenie</Text>
                  <Text style={s.timeRowValue}>{fmt(endTime)}</Text>
                </TouchableOpacity>
              )}
            </ScrollView>

            <View style={s.sheetBtns}>
              {editingEventId && (
                <TouchableOpacity style={s.cancelBtn} onPress={() => { setModal(false); handleDelete(editingEventId, title); }}>
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
              <Switch
                value={notifEnabled}
                onValueChange={async (v) => {
                  setNotifEnabled(v);
                  await SecureStore.setItemAsync('notif_enabled', String(v));
                }}
                trackColor={{ false: C.muted, true: C.accent }}
                thumbColor="#fff"
              />
            </View>

            {notifEnabled && (
              <>
                <Text style={[s.fieldLbl, { marginTop: 14, marginBottom: 10 }]}>CZAS PRZED WYDARZENIEM</Text>
                {NOTIF_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[s.notifOption, notifMinutes === opt.value && s.notifOptionActive]}
                    onPress={async () => {
                      setNotifMinutes(opt.value);
                      await SecureStore.setItemAsync('notif_minutes', String(opt.value));
                    }}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.notifOptionTxt, notifMinutes === opt.value && s.notifOptionTxtActive]}>
                      {opt.label}
                    </Text>
                    {notifMinutes === opt.value && <Text style={{ color: C.accent, fontWeight: '700' }}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </>
            )}
          </View>
        </View>
      </Modal>

      {picker && (
        <DateTimePicker
          value={pickerFor === 'start' ? startTime : endTime}
          mode="time" is24Hour display="default" onChange={onTime}
        />
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },

  // auth
  authScroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoBlock: { alignItems: 'center', marginBottom: 40 },
  logoMark: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: C.accent, justifyContent: 'center', alignItems: 'center',
    shadowColor: C.accent, shadowOpacity: 0.5, shadowRadius: 16, elevation: 6,
    marginBottom: 16,
  },
  logoMarkDot: { width: 24, height: 3, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 2 },
  logoTitle: { fontSize: 26, fontWeight: '800', color: C.text, letterSpacing: -0.5, marginBottom: 4 },
  logoSub: { fontSize: 13, color: C.sub },

  tabs: {
    flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 10, padding: 3, marginBottom: 20, gap: 3,
    borderWidth: 1, borderColor: C.border,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  tabActive: { backgroundColor: C.accent, shadowColor: C.accent, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4 },
  tabTxt: { color: C.sub, fontWeight: '600', fontSize: 13 },
  tabTxtActive: { color: '#fff' },

  authCard: {
    backgroundColor: C.card, borderRadius: 14,
    padding: 20, borderWidth: 1, borderColor: C.border,
  },
  fieldLbl: { color: C.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginBottom: 6, marginTop: 2 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: C.border,
    borderRadius: 9, color: C.text, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, marginBottom: 14,
  },
  submitBtn: {
    backgroundColor: C.accent, borderRadius: 10, paddingVertical: 14,
    alignItems: 'center', marginTop: 4,
    shadowColor: C.accent, shadowOpacity: 0.35, shadowRadius: 10, elevation: 4,
  },
  submitTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 12,
    backgroundColor: C.surface,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerTitle: { color: C.text, fontSize: 17, fontWeight: '700' },
  headerSub: { color: C.sub, fontSize: 12, marginTop: 1, textTransform: 'capitalize' },
  logoutBtn: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1, borderColor: C.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  logoutTxt: { color: C.sub, fontSize: 12, fontWeight: '600' },

  // calendar
  cal: { borderBottomWidth: 1, borderBottomColor: C.border },

  // list
  listWrap: { flex: 1, backgroundColor: C.bg },
  listHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 11,
    backgroundColor: C.surface,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  listDateTxt: { color: C.sub, fontSize: 12, fontWeight: '600', textTransform: 'capitalize', flex: 1 },
  badge: {
    backgroundColor: C.accentDim, borderRadius: 20,
    minWidth: 26, height: 26, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8,
  },
  badgeTxt: { color: C.accent, fontWeight: '700', fontSize: 12 },
  empty: { textAlign: 'center', color: C.muted, fontSize: 13, marginTop: 32 },

  eventCard: {
    flexDirection: 'row', backgroundColor: C.card, borderRadius: 10,
    marginBottom: 8, borderWidth: 1, borderColor: C.border, overflow: 'hidden',
  },
  eventStripe: { width: 3, backgroundColor: C.accent },
  eventContent: { flex: 1, padding: 12 },
  eventTime: { color: C.sub, fontSize: 11, fontWeight: '600', marginBottom: 3 },
  eventTitle: { color: C.text, fontSize: 14, fontWeight: '600' },
  eventDesc: { color: C.muted, fontSize: 12, marginTop: 3 },

  // FAB
  fab: {
    position: 'absolute', right: 18, bottom: 22,
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: C.accent, justifyContent: 'center', alignItems: 'center',
    shadowColor: C.accent, shadowOpacity: 0.45, shadowRadius: 12, elevation: 8,
  },
  fabTxt: { fontSize: 26, color: '#fff', fontWeight: '300', lineHeight: 30 },

  // sheet
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet: {
    backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    borderTopWidth: 1, borderColor: 'rgba(99,102,241,0.2)',
    maxHeight: '88%',
  },
  sheetHandle: { width: 36, height: 4, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  sheetTitle: { color: C.text, fontSize: 16, fontWeight: '700' },
  sheetSub: { color: C.sub, fontSize: 12, marginBottom: 18, textTransform: 'capitalize' },
  closeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  closeTxt: { color: C.sub, fontSize: 13 },

  timeRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 9,
    paddingHorizontal: 14, paddingVertical: 13,
    marginBottom: 12, borderWidth: 1, borderColor: C.border,
  },
  timeRowLabel: { color: C.sub, fontSize: 13 },
  timeRowValue: { color: C.accent, fontSize: 17, fontWeight: '700' },

  switchRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 9,
    marginBottom: 12, borderWidth: 1, borderColor: C.border,
  },
  switchLbl: { color: C.sub, fontSize: 13 },

  sheetBtns: { flexDirection: 'row', gap: 10, marginTop: 12 },
  cancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 10,
    alignItems: 'center', borderWidth: 1, borderColor: C.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  cancelTxt: { color: C.sub, fontWeight: '600', fontSize: 14 },
  saveBtn: {
    flex: 2, paddingVertical: 13, borderRadius: 10,
    alignItems: 'center', backgroundColor: C.accent,
    shadowColor: C.accent, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
  },
  saveTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // settings
  settingsBtn: {
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1, borderColor: C.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  settingsTxt: { fontSize: 15 },

  notifOption: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 9,
    marginBottom: 8, borderWidth: 1, borderColor: C.border,
  },
  notifOptionActive: {
    borderColor: C.accent, backgroundColor: C.accentDim,
  },
  notifOptionTxt: { color: C.sub, fontSize: 13 },
  notifOptionTxtActive: { color: C.accent, fontWeight: '600' },
});
