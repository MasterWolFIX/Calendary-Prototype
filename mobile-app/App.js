import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, StatusBar, KeyboardAvoidingView, Platform, FlatList, Modal, Switch
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

// Konfiguracja obsługi powiadomień gdy aplikacja jest włączona
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// --- Polskie tłumaczenia kalendarza ---
LocaleConfig.locales['pl'] = {
  monthNames: ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'],
  monthNamesShort: ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'],
  dayNames: ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'],
  dayNamesShort: ['Nie', 'Pon', 'Wto', 'Śro', 'Czw', 'Pią', 'Sob'],
  today: 'Dzisiaj'
};
LocaleConfig.defaultLocale = 'pl';

const API_URL = 'http://192.168.1.55:3000/api';

const EVENT_COLORS = [
  '#7c5cfc', '#06b6d4', '#f59e0b', '#34d399',
  '#f87171', '#fb7185', '#a78bfa', '#38bdf8',
];

const calendarTheme = {
  calendarBackground: '#13162a',
  textSectionTitleColor: '#8b8fa8',
  selectedDayBackgroundColor: '#7c5cfc',
  selectedDayTextColor: '#ffffff',
  todayTextColor: '#06b6d4',
  dayTextColor: '#f0f0ff',
  textDisabledColor: '#555870',
  dotColor: '#7c5cfc',
  selectedDotColor: '#ffffff',
  arrowColor: '#A78BFA',
  monthTextColor: '#F8F9FA',
  textDayFontWeight: '500',
  textMonthFontWeight: 'bold',
  textDayHeaderFontWeight: '500'
};

export default function App() {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const [eventsMap, setEventsMap] = useState({});
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Auth form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Dodawanie wydarzenia (Modal)
  const [modalVisible, setModalVisible] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDesc, setNewEventDesc] = useState('');

  // Czasy Start / Koniec dla nowego wydarzenia
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [hasEndTime, setHasEndTime] = useState(true);
  const [newEventColor, setNewEventColor] = useState(EVENT_COLORS[0]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState('startTime'); // 'startTime' albo 'endTime'

  // Flaga odświeżania wydarzeń
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const checkToken = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync('calendary_token');
        if (storedToken) setToken(storedToken);
      } catch (e) {
        console.error('Błąd tokena', e);
      } finally {
        setLoading(false);
      }
    };
    checkToken();
  }, []);

  useEffect(() => {
    if (!token) return;

    const fetchAllEvents = async () => {
      try {
        const today = new Date();
        const start = new Date(today.getFullYear() - 1, today.getMonth(), 1).toISOString();
        const end = new Date(today.getFullYear() + 1, today.getMonth(), 0).toISOString();

        const response = await axios.get(`${API_URL}/events`, {
          params: { from: start, to: end },
          headers: { Authorization: `Bearer ${token}` }
        });

        const evMap = {};
        response.data.events.forEach((ev) => {
          const dayStr = ev.start_date.split('T')[0];
          if (!evMap[dayStr]) evMap[dayStr] = [];
          evMap[dayStr].push({ ...ev, start: new Date(ev.start_date), end: new Date(ev.end_date) });
        });

        Object.keys(evMap).forEach(key => {
          evMap[key].sort((a, b) => a.start.getTime() - b.start.getTime());
        });

        setEventsMap(evMap);
      } catch (err) {
        if (err.response?.status === 401) {
          Alert.alert('Sesja wygasła', 'Zaloguj się ponownie.');
          handleLogout();
        }
      }
    };
    fetchAllEvents();

    // Asynchroniczne sprawdzenie uprawnień i wysyłka Push Token na serwer
    async function registerAndSendPushToken() {
      if (!Device.isDevice) {
        console.log('Powiadomienia Push nie działają na fizycznych symulatorach tak prosto.')
        return;
      }
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        return; // Brak uprawnień :(
      }

      // Pobieramy ProjectID dynamicznie dla najnowszych wersji Expo
      const projectId = 'b23a7e32-2d64-4bf8-b223-28c04ec55ec9'; // Pusta/Słaba wartość dla celów prototypu, ale getExpoPushToken wyciągnie z app.json.
      try {
        const pushTokenData = await Notifications.getExpoPushTokenAsync({ projectId: 'your-project-id' }).catch(() => null)
          || await Notifications.getExpoPushTokenAsync(); // Fallback bez projektu

        if (pushTokenData && pushTokenData.data) {
          // Wyślij pushToken do backendu, żeby nas wołał
          await axios.post(`${API_URL}/auth/fcm-token`, { token: pushTokenData.data }, { headers: { Authorization: `Bearer ${token}` } });
          console.log('Wysłano Expo Push Token na serwer: ', pushTokenData.data);
        }
      } catch (error) {
        console.log("Błąd podczas rejestracji Push Token: ", error);
      }
    }
    registerAndSendPushToken();

  }, [token, refreshKey]);

  const handleLogin = async () => {
    if (!email || !password) return Alert.alert('Błąd', 'Podaj email i hasło.');
    setAuthLoading(true);
    try {
      const resp = await axios.post(`${API_URL}/auth/login`, { email: email.trim(), password });
      await SecureStore.setItemAsync('calendary_token', resp.data.token);
      setToken(resp.data.token);
    } catch (err) {
      Alert.alert('Błąd', err.response?.data?.error || 'Brak połączenia z serwerem.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync('calendary_token');
    setToken(null);
    setEventsMap({});
  };

  // Dodawanie Wydarzenia
  const handleAddEvent = async () => {
    if (!newEventTitle) return Alert.alert('Błąd', 'Tytuł jest wymagany!');

    // Ustalanie ostatecznej daty na podstawie wybranego dnia
    const yyMmDd = selectedDate.split('-');

    // Budujemy poprawne obiekty Date dla wybranego dnia, z ustawioną godziną
    const finalizeDate = (timeObj) => {
      const d = new Date(timeObj);
      d.setFullYear(yyMmDd[0], yyMmDd[1] - 1, yyMmDd[2]);
      return d.toISOString();
    };

    try {
      await axios.post(`${API_URL}/events`, {
        title: newEventTitle,
        description: newEventDesc,
        start_date: finalizeDate(startTime),
        end_date: hasEndTime ? finalizeDate(endTime) : null,
        color: newEventColor
      }, { headers: { Authorization: `Bearer ${token}` } });

      Alert.alert('Sukces', 'Zapisano wydarzenie!');
      setModalVisible(false);
      setNewEventTitle('');
      setNewEventDesc('');
      setNewEventColor(EVENT_COLORS[0]);
      setRefreshKey(prev => prev + 1); // Odśwież widok
    } catch (error) {
      Alert.alert('Błąd', 'Nie udało się dodać wydarzenia.');
    }
  };

  // Usuwanie wydarzena (Długie Naciśniecie)
  const handleDeleteEvent = (eventId, eventTitle) => {
    Alert.alert('Usuń wydarzenie', `Czy na pewno chcesz usunąć: ${eventTitle}?`, [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Usuń', style: 'destructive', onPress: async () => {
          try {
            await axios.delete(`${API_URL}/events/${eventId}`, { headers: { Authorization: `Bearer ${token}` } });
            Alert.alert('Usunięto', 'Wydarzenie zostało trwale usunięte.');
            setRefreshKey(prev => prev + 1);
          } catch (e) { Alert.alert('Błąd', 'Błąd podczas usuwania.'); }
        }
      }
    ]);
  };

  // Zarządzanie Pickerem czasu
  const onChangeTime = (event, selectedValue) => {
    setShowPicker(false);
    if (selectedValue) {
      if (pickerMode === 'startTime') setStartTime(selectedValue);
      else setEndTime(selectedValue);
    }
  };

  const openTimePicker = (mode) => {
    setPickerMode(mode);
    setShowPicker(true);
  };

  const currentEvents = eventsMap[selectedDate] || [];
  const markedDates = {
    ...Object.keys(eventsMap).reduce((acc, date) => {
      // Bierzemy kolor pierwszej kropki jeśli są wydarzenia
      const color = eventsMap[date][0]?.color || '#7c5cfc';
      acc[date] = { marked: true, dotColor: color };
      return acc;
    }, {})
  };
  markedDates[selectedDate] = { ...(markedDates[selectedDate] || {}), selected: true, selectedColor: '#7c5cfc' };

  const formatTime = (d) => `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;

  const renderEventItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.itemCard, { borderLeftColor: item.color || '#7c5cfc', borderLeftWidth: 4 }]}
      onLongPress={() => handleDeleteEvent(item.id, item.title)}
      onPress={() => Alert.alert('Szczegóły', `${item.title}\n${item.description}\n\nOd: ${formatTime(item.start)}${item.end_date ? `\nDo: ${formatTime(item.end)}` : ''}`)}
    >
      <View style={styles.itemHeader}>
        <Text style={[styles.itemTime, { color: item.color || '#06b6d4' }]}>
          {formatTime(item.start)} {item.end_date ? `- ${formatTime(item.end)}` : '(Cały dzień)'}
        </Text>
        <View style={[styles.colorDot, { backgroundColor: item.color || '#7c5cfc' }]} />
      </View>
      <Text style={styles.itemTitle}>{item.title}</Text>
      {item.description ? <Text style={styles.itemDesc} numberOfLines={1}>{item.description}</Text> : null}
      <Text style={styles.trashHint}>(Przytrzymaj by usunąć)</Text>
    </TouchableOpacity>
  );

  if (loading) return <View style={styles.centerContainer}><ActivityIndicator size="large" color="#7c5cfc" /></View>;

  // KALENDARZ GIŁÓWNY (PO ZALOGOWANIU)
  if (token) {
    return (
      <View style={styles.safeContainer}>
        <StatusBar barStyle="light-content" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Moje wydarzenia</Text>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Wyloguj</Text>
          </TouchableOpacity>
        </View>

        <Calendar
          current={selectedDate}
          onDayPress={(day) => setSelectedDate(day.dateString)}
          markedDates={markedDates}
          theme={calendarTheme}
          style={styles.calendarStyle}
        />

        <View style={styles.listContainer}>
          <Text style={styles.listHeader}>Dzień: {selectedDate}</Text>
          {currentEvents.length === 0 ? (
            <Text style={styles.emptyText}>Brak planów, zrób sobie herbatkę ☕</Text>
          ) : (
            <FlatList
              data={currentEvents}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderEventItem}
              contentContainerStyle={styles.flatListContent}
            />
          )}

          {/* Floating Action Button (FAB) */}
          <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Modal Nowego Wydarzenia */}
        <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Dodaj do: {selectedDate}</Text>

              <TextInput style={styles.modalInput} placeholder="Wpisz Tytuł..."
                placeholderTextColor="#64748B" value={newEventTitle} onChangeText={setNewEventTitle} />
              <TextInput style={[styles.modalInput, styles.textArea]} placeholder="Notatka (opcjonalnie)"
                placeholderTextColor="#64748B" multiline value={newEventDesc} onChangeText={setNewEventDesc} />

              <View style={styles.switchContainer}>
                <Text style={styles.switchLabel}>Czas zakończenia</Text>
                <Switch
                  value={hasEndTime}
                  onValueChange={setHasEndTime}
                  trackColor={{ false: '#334155', true: '#7c5cfc' }}
                  thumbColor={hasEndTime ? '#fff' : '#94a3b8'}
                />
              </View>

              {/* Pickery */}
              <View style={styles.timePickers}>
                <TouchableOpacity style={styles.timeBtn} onPress={() => openTimePicker('startTime')}>
                  <Text style={styles.timeLabel}>Od:</Text>
                  <Text style={styles.timeValue}>{formatTime(startTime)}</Text>
                </TouchableOpacity>
                {hasEndTime && (
                  <TouchableOpacity style={styles.timeBtn} onPress={() => openTimePicker('endTime')}>
                    <Text style={styles.timeLabel}>Do:</Text>
                    <Text style={styles.timeValue}>{formatTime(endTime)}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Wybór koloru */}
              <Text style={[styles.inputLabel, { marginBottom: 10 }]}>KOLOR WYDARZENIA</Text>
              <View style={styles.colorPickerContainer}>
                {EVENT_COLORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setNewEventColor(c)}
                    style={[
                      styles.colorCircle,
                      { backgroundColor: c },
                      newEventColor === c && styles.colorCircleSelected
                    ]}
                  >
                    {newEventColor === c && <Text style={styles.checkIcon}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                  <Text style={styles.cancelText}>Anuluj</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleAddEvent}>
                  <Text style={styles.saveText}>Zapisz</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Natywny wyświetlacz czasu Android */}
        {showPicker && (
          <DateTimePicker
            value={pickerMode === 'startTime' ? startTime : endTime}
            mode="time"
            is24Hour={true}
            display="default"
            onChange={onChangeTime}
          />
        )}
      </View>
    );
  }

  // --- LOGOWANIE ---
  return (
    <View style={styles.safeContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0D17" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.loginWrapper}>
        <View style={styles.loginBox}>
          <Text style={styles.logoIcon}>📅</Text>
          <Text style={styles.logoTitle}>Calendary</Text>
          <Text style={styles.logoSubtitle}>Mobile App v2</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>ADRES E-MAIL</Text>
            <TextInput style={styles.input} placeholder="ty@example.com" placeholderTextColor="#64748B"
              keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>HASŁO</Text>
            <TextInput style={styles.input} placeholder="••••••••" placeholderTextColor="#64748B"
              secureTextEntry value={password} onChangeText={setPassword} />
          </View>

          <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={authLoading}>
            {authLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginBtnText}>Zaloguj się</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0B0D17' },
  safeContainer: { flex: 1, backgroundColor: '#0B0D17', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#121523', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  headerTitle: { color: '#F8F9FA', fontSize: 20, fontWeight: '700' },
  logoutBtn: { padding: 8, backgroundColor: 'rgba(248,113,113,0.1)', borderRadius: 8 },
  logoutText: { color: '#F87171', fontWeight: 'bold' },
  loginWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loginBox: { width: '100%', maxWidth: 400, backgroundColor: '#121523', borderRadius: 20, padding: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  logoIcon: { fontSize: 50, textAlign: 'center', marginBottom: 10 },
  logoTitle: { fontSize: 28, fontWeight: '800', color: '#fff', textAlign: 'center' },
  logoSubtitle: { color: '#A78BFA', textAlign: 'center', marginBottom: 30, fontSize: 16 },
  inputContainer: { marginBottom: 20 },
  inputLabel: { color: '#94A3B8', fontSize: 12, fontWeight: '700', marginBottom: 8, letterSpacing: 1 },
  input: { backgroundColor: 'rgba(0,0,0,0.3)', color: '#F8F9FA', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },
  loginBtn: { backgroundColor: '#7C5CFC', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  loginBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  calendarStyle: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  listContainer: { flex: 1, backgroundColor: '#0d0f1a', position: 'relative' },
  listHeader: { color: '#8b8fa8', fontSize: 14, fontWeight: '700', padding: 15, backgroundColor: '#121523' },
  flatListContent: { padding: 15, paddingBottom: 100 },
  itemCard: { backgroundColor: '#13162a', borderRadius: 10, padding: 15, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)' },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  itemTime: { fontSize: 13, fontWeight: 'bold' },
  itemTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  itemDesc: { color: '#94A3B8', fontSize: 13, marginTop: 5 },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  emptyText: { textAlign: 'center', color: '#64748B', fontSize: 14, marginTop: 30 },
  trashHint: { color: '#EF4444', fontSize: 10, marginTop: 10, opacity: 0.6 },

  fab: { position: 'absolute', right: 20, bottom: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#7c5cfc', justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.8, shadowRadius: 2 },
  fabText: { fontSize: 30, color: '#fff', lineHeight: 34 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox: { width: '100%', backgroundColor: '#121523', borderRadius: 20, padding: 25, borderWidth: 1, borderColor: '#7c5cfc' },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  modalInput: { backgroundColor: 'rgba(0,0,0,0.3)', color: '#fff', padding: 15, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  textArea: { height: 80, textAlignVertical: 'top' },

  switchContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, backgroundColor: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 10 },
  switchLabel: { color: '#fff', fontSize: 14 },

  timePickers: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  timeBtn: { flex: 1, backgroundColor: 'rgba(124, 92, 252, 0.1)', padding: 15, borderRadius: 10, marginHorizontal: 5, alignItems: 'center' },
  timeLabel: { color: '#94A3B8', fontSize: 12, marginBottom: 5 },
  timeValue: { color: '#06b6d4', fontSize: 16, fontWeight: 'bold' },

  colorPickerContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 25 },
  colorCircle: { width: 35, height: 35, borderRadius: 17.5, justifyContent: 'center', alignItems: 'center' },
  colorCircleSelected: { borderWidth: 2, borderColor: '#fff' },
  checkIcon: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
  cancelBtn: { padding: 15, marginRight: 10 },
  cancelText: { color: '#94A3B8', fontWeight: 'bold' },
  saveBtn: { backgroundColor: '#7C5CFC', paddingHorizontal: 25, paddingVertical: 15, borderRadius: 10 },
  saveText: { color: '#fff', fontWeight: 'bold' }
});
