import { registerRootComponent } from 'expo';
import { registerWidget } from 'react-native-android-widget';
import { Platform } from 'react-native';

import App from './App';
import { CalendaryWidget } from './Widget';

// ── Rejestracja Widgetu (Działa tylko w buildzie natywnym) ───────────────────────
try {
    if (Platform.OS === 'android') {
        registerWidget('CalendaryWidget', () => CalendaryWidget);
    }
} catch (e) {
    console.log('Widget registration skipped (Expected in Expo Go):', e.message);
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
