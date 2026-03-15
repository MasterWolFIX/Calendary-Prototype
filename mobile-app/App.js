import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, SafeAreaView, StatusBar, KeyboardAvoidingView, Platform
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { Agenda, LocaleConfig } from 'react-native-calendars';

// --- Polskie tłumaczenia kalendarza ---
LocaleConfig.locales['pl'] = {
  monthNames: ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'],
  monthNamesShort: ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'],
  dayNames: ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'],
  dayNamesShort: ['Nie', 'Pon', 'Wto', 'Śro', 'Czw', 'Pią', 'Sob'],
  today: 'Dzisiaj'
};
LocaleConfig.defaultLocale = 'pl';

// --- WAŻNE ---
// Jeśli testujesz przez Expo Go na fizycznym telefonie, zastąp "localhost" swoimi numerkami IP z sieci Wi-Fi (np. 192.168.0.x)
// W dalszym etapie będzie tu po prostu bezpieczny link z Cloudflare (np. https://twoj-tunel.trycloudflare.com/api)
const API_URL = 'http://192.168.1.55:3000/api';

export default function App() {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState({});

  // Formularz logowania
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    // Sprawdza przy każdym załadowaniu, czy mamy w pamięci (SecureStore) token JWT
    const checkToken = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync('calendary_token');
        if (storedToken) setToken(storedToken);
      } catch (e) {
        console.error('Błąd podczas ładowania tokena', e);
      } finally {
        setLoading(false);
      }
    };
    checkToken();
  }, []);

  // --- LOGOWANIE ---
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Błąd', 'Podaj adres e-mail i hasło.');
      return;
    }

    setAuthLoading(true);
    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        email: email.trim(),
        password: password
      });

      const jwtToken = response.data.token;
      await SecureStore.setItemAsync('calendary_token', jwtToken);
      setToken(jwtToken);
    } catch (err) {
      Alert.alert('Błąd logowania', err.response?.data?.error || 'Nie można połączyć się z serwerem. Zmień IP w kodzie.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync('calendary_token');
    setToken(null);
    setItems({});
  };

  // --- POBIERANIE WYDARZEŃ (Agenda) ---
  const loadEventsForMonth = async (month) => {
    // month to obiekt z daty przebytej na ekranie, pobieramy od serwera cały zakres
    const year = month.year;
    const m = month.month;
    // tworzymy lekki bufor (pobieramy np. od początku tego miesiąca do końca)
    const startDate = new Date(year, m - 1, 1).toISOString();
    const endDate = new Date(year, m + 1, 0).toISOString();

    try {
      const response = await axios.get(`${API_URL}/events`, {
        params: { from: startDate, to: endDate },
        headers: { Authorization: `Bearer ${token}` }
      });

      const dbEvents = response.data.events;
      const newItems = { ...items };

      dbEvents.forEach((ev) => {
        // Z formatu "2025-06-15T10:00:00.000Z" na klucz Agendy: "2025-06-15"
        const dayStr = ev.start_date.split('T')[0];

        if (!newItems[dayStr]) {
          newItems[dayStr] = [];
        }

        // Zabezpieczenie przed dublowaniem przy kolejnym loadItems
        const exists = newItems[dayStr].find((i) => i.id === ev.id);
        if (!exists) {
          newItems[dayStr].push({
            id: ev.id,
            name: ev.title,
            description: ev.description || '',
            start: new Date(ev.start_date),
            end: new Date(ev.end_date)
          });
        }
      });

      setItems(newItems);
    } catch (err) {
      if (err.response?.status === 401) {
        Alert.alert('Wygasł token', 'Zaloguj się ponownie.');
        handleLogout();
      } else {
        console.error('Błąd pobierania wydarzeń:', err.message);
      }
    }
  };

  const renderItem = (item) => {
    const formatTime = (dateObj) => {
      const h = dateObj.getHours().toString().padStart(2, '0');
      const m = dateObj.getMinutes().toString().padStart(2, '0');
      return `${h}:${m}`;
    };

    return (
      <TouchableOpacity
        style={styles.itemCard}
        onPress={() => Alert.alert('Szczegóły', `${item.name}\n${item.description}\n\nOd: ${formatTime(item.start)}\nDo: ${formatTime(item.end)}`)}
      >
        <Text style={styles.itemTime}>{formatTime(item.start)} - {formatTime(item.end)}</Text>
        <Text style={styles.itemTitle}>{item.name}</Text>
        {item.description ? <Text style={styles.itemDesc} numberOfLines={1}>{item.description}</Text> : null}
      </TouchableOpacity>
    );
  };

  const renderEmptyDate = () => {
    return (
      <View style={styles.emptyDateBox}>
        <Text style={styles.emptyDateText}>Brak wydarzeń w tym dniu.</Text>
      </View>
    );
  };

  // --- RENDEROWANIE GŁÓWNE ---
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#7c5cfc" />
      </View>
    );
  }

  // --- EKRAN AGENDY (po zalogowaniu) ---
  if (token) {
    return (
      <SafeAreaView style={styles.containerDark}>
        <StatusBar barStyle="light-content" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Agenda Młodego</Text>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Wyloguj</Text>
          </TouchableOpacity>
        </View>

        <Agenda
          items={items}
          loadItemsForMonth={loadEventsForMonth}
          renderItem={renderItem}
          renderEmptyDate={renderEmptyDate}
          theme={{
            agendaDayTextColor: '#A78BFA',
            agendaDayNumColor: '#A78BFA',
            agendaTodayColor: '#7c5cfc',
            agendaKnobColor: '#7c5cfc',
            backgroundColor: '#0d0f1a', // tło pod agendą
            calendarBackground: '#13162a', // tło widoku "miesiąca"
            textSectionTitleColor: '#8b8fa8',
            selectedDayBackgroundColor: '#7c5cfc',
            selectedDayTextColor: '#ffffff',
            todayTextColor: '#06b6d4',
            dayTextColor: '#f0f0ff',
            textDisabledColor: '#555870',
            dotColor: '#7c5cfc',
            selectedDotColor: '#ffffff',
          }}
          showClosingKnob={true} // pociągnij, by zwinąć lub zsuń (belka)
        />
      </SafeAreaView>
    );
  }

  // --- EKRAN LOGOWANIA (jeśli brak tokena) ---
  return (
    <SafeAreaView style={styles.containerDark}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0D17" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.loginWrapper}>
        <View style={styles.loginBox}>
          <Text style={styles.logoIcon}>📅</Text>
          <Text style={styles.logoTitle}>Calendary</Text>
          <Text style={styles.logoSubtitle}>Aplikacja mobilna</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>ADRES E-MAIL</Text>
            <TextInput
              style={styles.input}
              placeholder="ty@example.com"
              placeholderTextColor="#64748B"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>HASŁO</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#64748B"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={authLoading}>
            {authLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginBtnText}>Zaloguj się</Text>
            )}
          </TouchableOpacity>
          <Text style={styles.footerHint}>Uwaga przygotowawcza: Jeśli testujesz na smartfonie z domowym Wi-fi, przed uruchomieniem zmień linijkę API_URL na dysku w pliku App.js na swoje wewnętrzne IP (ipv4 ze sterownika rutera Twojego komputera wpisane we wiersz poleceń komendą 'ipconfig').</Text>

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0B0D17',
  },
  containerDark: {
    flex: 1, backgroundColor: '#0B0D17',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#121523',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)'
  },
  headerTitle: {
    color: '#F8F9FA', fontSize: 20, fontWeight: '700'
  },
  logoutBtn: {
    padding: 8, backgroundColor: 'rgba(248,113,113,0.1)', borderRadius: 8
  },
  logoutText: {
    color: '#F87171', fontWeight: 'bold'
  },
  loginWrapper: {
    flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20
  },
  loginBox: {
    width: '100%', maxWidth: 400, backgroundColor: '#121523', borderRadius: 20,
    padding: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)'
  },
  logoIcon: {
    fontSize: 50, textAlign: 'center', marginBottom: 10
  },
  logoTitle: {
    fontSize: 28, fontWeight: '800', color: '#fff', textAlign: 'center'
  },
  logoSubtitle: {
    color: '#A78BFA', textAlign: 'center', marginBottom: 30, fontSize: 16
  },
  inputContainer: { marginBottom: 20 },
  inputLabel: {
    color: '#94A3B8', fontSize: 12, fontWeight: '700', marginBottom: 8, letterSpacing: 1
  },
  input: {
    backgroundColor: 'rgba(0,0,0,0.3)', color: '#F8F9FA', padding: 15,
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)'
  },
  loginBtn: {
    backgroundColor: '#7C5CFC', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10
  },
  loginBtnText: {
    color: '#fff', fontWeight: '700', fontSize: 16
  },
  footerHint: {
    color: '#555870', fontSize: 10, marginTop: 25, textAlign: 'center'
  },
  // --- Agenda Items ---
  itemCard: {
    backgroundColor: '#121523',
    flex: 1,
    borderRadius: 10,
    padding: 15,
    marginRight: 10,
    marginTop: 17,
    borderWidth: 1, borderColor: 'rgba(124, 92, 252, 0.3)'
  },
  itemTime: { color: '#06b6d4', fontSize: 13, fontWeight: 'bold', marginBottom: 4 },
  itemTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  itemDesc: { color: '#94A3B8', fontSize: 13, marginTop: 5 },
  emptyDateBox: { height: 15, flex: 1, paddingTop: 30 },
  emptyDateText: { textAlign: 'center', color: '#64748B', fontSize: 14 }
});
