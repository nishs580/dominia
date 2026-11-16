import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ClerkProvider } from '@clerk/clerk-expo';
import { tokenCache } from './lib/clerk';
import { StyleSheet, Text, View } from 'react-native';
import ActivityScreen from './screens/ActivityScreen';
import ProfileScreen from './screens/ProfileScreen';
import ProfileAccordionScreen from './screens/ProfileAccordionScreen';
import EditProfileScreen from './screens/EditProfileScreen';
import AllianceScreen from './screens/AllianceScreen';
import MapScreen from './screens/MapScreen';
import ActiveClaimScreen from './screens/ActiveClaimScreen';
import ClaimSuccessScreen from './screens/ClaimSuccessScreen';
import ContestResultScreen from './screens/ContestResultScreen';
import DefenderAcceptScreen from './screens/DefenderAcceptScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import SessionMismatchScreen from './screens/SessionMismatchScreen';
import AllianceJoinedScreen from './screens/AllianceJoinedScreen';
import CreateAllianceScreen from './screens/CreateAllianceScreen';
import WalletScreen from './screens/WalletScreen';
import HealthConnectDebugScreen from './screens/HealthConnectDebugScreen';
import WelcomeScreen from './screens/WelcomeScreen';
import SignInScreen from './screens/SignInScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import UsernameScreen from './screens/UsernameScreen';
import WarRoomScreen from './screens/WarRoomScreen';
import CommandPostScreen from './screens/CommandPostScreen';
import ActivityLogScreen from './screens/ActivityLogScreen';
import LeaderboardsScreen from './screens/LeaderboardsScreen';
import ChatScreen from './screens/ChatScreen';
import PublicProfileScreen from './screens/PublicProfileScreen';
import MissionsScreen from './screens/MissionsScreen';
import EventsScreen from './screens/EventsScreen';
import AuthGate from './components/AuthGate';
import ActivitySyncLifecycle from './components/ActivitySyncLifecycle';
import FcmLifecycle from './components/FcmLifecycle';
import FlagsLifecycle from './components/FlagsLifecycle';
import StreakBreakLifecycle from './components/StreakBreakLifecycle';
import { navigationRef, onNavigationReady } from './lib/navigation';
import { ensureFlagsInitialized, useFlag } from './lib/flags';
import { tabsFor, rootRoutesFor } from './lib/navLayout';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  MapGlyph,
  ActivityGlyph,
  AllianceGlyph,
  ProfileGlyph,
  BoardsGlyph,
} from './components/ResourceGlyphs';
import Toast from 'react-native-toast-message';
import NotificationCard from './components/notifications/NotificationCard';
import NotificationBanner from './components/notifications/NotificationBanner';
import { useFonts } from 'expo-font';
import { useTranslation } from 'react-i18next';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import {
  Archivo_700Bold,
  Archivo_700Bold_Italic,
  Archivo_800ExtraBold,
  Archivo_900Black,
} from '@expo-google-fonts/archivo';
import {
  GeistMono_300Light,
  GeistMono_400Regular,
  GeistMono_500Medium,
} from '@expo-google-fonts/geist-mono';
import {
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
} from '@expo-google-fonts/instrument-sans';

SplashScreen.preventAutoHideAsync();

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function PlaceholderScreen({ label }) {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{label}</Text>
    </View>
  );
}

// The Profile route in either layout: today's ProfileScreen with `power_rank`
// on, the Figma accordion with it off (plan U16).
function ProfileRoute(props) {
  const powerRank = useFlag('power_rank');
  return powerRank ? <ProfileScreen {...props} /> : <ProfileAccordionScreen {...props} />;
}

function makeTabOptions(label, Icon) {
  return {
    tabBarIcon: ({ color }) => <Icon size={20} color={color} />,
    tabBarLabel: ({ focused, color }) => (
      <Text
        maxFontSizeMultiplier={1.3}
        numberOfLines={1}
        style={{
          fontFamily: focused ? 'GeistMono_500Medium' : 'GeistMono_400Regular',
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: 1.4,
          includeFontPadding: false,
          color,
        }}
      >
        {label}
      </Text>
    ),
  };
}

// Every tab either layout can show. Which ones mount is decided by
// `legacy_tabs` through lib/navLayout: Map · Activity · Alliance · Profile
// with it on (today), Map · Missions · Alliance · Events with it off.
const TAB_SCREENS = {
  Map: { component: MapScreen, labelKey: 'tabs.map', Icon: MapGlyph },
  Activity: { component: ActivityScreen, labelKey: 'tabs.activity', Icon: ActivityGlyph },
  Alliance: { component: AllianceScreen, labelKey: 'tabs.alliance', Icon: AllianceGlyph },
  Profile: { component: ProfileRoute, labelKey: 'tabs.profile', Icon: ProfileGlyph },
  // Tab icons stay for now; DESIGN.md's no-icons rule is deferred (plan U9).
  Missions: { component: MissionsScreen, labelKey: 'tabs.missions', Icon: ActivityGlyph },
  Events: { component: EventsScreen, labelKey: 'tabs.events', Icon: BoardsGlyph },
};

// Root stack screens that only exist in one layout. With `legacy_tabs` off,
// Profile leaves the tab bar and opens from the header avatar.
const ROOT_SCREENS = {
  Profile: ProfileRoute,
};

const TabNavigator = () => {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const legacyTabs = useFlag('legacy_tabs');
  return (
    <View style={{ flex: 1 }}>
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: {
          backgroundColor: '#0E1014',
          borderTopWidth: 1,
          borderTopColor: 'rgba(242,238,230,0.16)',
          elevation: 0,
          height: 62 + insets.bottom,
          paddingTop: 10,
          paddingBottom: insets.bottom + 10,
        },
        tabBarActiveTintColor: '#F2EEE6',
        tabBarInactiveTintColor: '#5C6068',
        headerShown: false,
      }}
    >
      {tabsFor(legacyTabs).map((name) => {
        const { component, labelKey, Icon } = TAB_SCREENS[name];
        return (
          <Tab.Screen
            key={name}
            name={name}
            options={makeTabOptions(t(labelKey), Icon)}
            component={component}
          />
        );
      })}
    </Tab.Navigator>
    </View>
  );
};

export default function App() {
  const [fontsLoaded] = useFonts({
    Archivo_700Bold,
    Archivo_700Bold_Italic,
    Archivo_800ExtraBold,
    Archivo_900Black,
    GeistMono_300Light,
    GeistMono_400Regular,
    GeistMono_500Medium,
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
  });

  // Start on the last activated flag values so the first frame is already in
  // the right mode. Capped at 300 ms; on timeout the app starts on defaults
  // and FlagsLifecycle catches up in the background.
  const [flagsReady, setFlagsReady] = useState(false);
  const legacyTabs = useFlag('legacy_tabs');
  useEffect(() => {
    ensureFlagsInitialized().finally(() => setFlagsReady(true));
  }, []);

  useEffect(() => {
    if (fontsLoaded && flagsReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, flagsReady]);

  if (!fontsLoaded || !flagsReady) {
    return null;
  }

  return (
    <ClerkProvider
      publishableKey="pk_test_bGVuaWVudC1nb29zZS01My5jbGVyay5hY2NvdW50cy5kZXYk"
      tokenCache={tokenCache}
    >
      <SafeAreaProvider>
      <ActivitySyncLifecycle />
      <FcmLifecycle />
      <FlagsLifecycle />
      <StreakBreakLifecycle />
      <NavigationContainer ref={navigationRef} onReady={onNavigationReady}>
        <Stack.Navigator initialRouteName="AuthGate" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="AuthGate" component={AuthGate} />
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="SignIn" component={SignInScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="Username" component={UsernameScreen} />
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="SessionMismatch" component={SessionMismatchScreen} />
          <Stack.Screen name="MainTabs" component={TabNavigator} />
          <Stack.Screen name="ActivityLog" component={ActivityLogScreen} />
          <Stack.Screen name="Leaderboards" component={LeaderboardsScreen} />
          <Stack.Screen name="Chat" component={ChatScreen} />
          <Stack.Screen name="PublicProfile" component={PublicProfileScreen} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} />
          {rootRoutesFor(legacyTabs).map((name) => (
            <Stack.Screen key={name} name={name} component={ROOT_SCREENS[name]} />
          ))}
          <Stack.Screen
            name="WarRoom"
            component={WarRoomScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="CommandPost"
            component={CommandPostScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen name="ActiveClaim" component={ActiveClaimScreen} options={{ headerShown: false, tabBarStyle: { display: 'none' } }} />
          <Stack.Screen name="ClaimSuccessScreen" component={ClaimSuccessScreen} options={{ headerShown: false, tabBarStyle: { display: 'none' } }} />
          <Stack.Screen name="ContestResultScreen" component={ContestResultScreen} options={{ headerShown: false, tabBarStyle: { display: 'none' } }} />
          <Stack.Screen name="DefenderAccept" component={DefenderAcceptScreen} options={{ headerShown: false, tabBarStyle: { display: 'none' } }} />
          <Stack.Screen name="AllianceJoined" component={AllianceJoinedScreen} options={{ headerShown: false, tabBarStyle: { display: 'none' } }} />
          <Stack.Screen name="CreateAlliance" component={CreateAllianceScreen} options={{ headerShown: false }} />
          <Stack.Screen
            name="Wallet"
            component={WalletScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="HealthConnectDebug"
            component={HealthConnectDebugScreen}
            options={{ headerShown: false }}
          />
        </Stack.Navigator>
        <StatusBar style="light" />
      </NavigationContainer>
      <NotificationCard />
      <NotificationBanner />
      <Toast />
      </SafeAreaProvider>
    </ClerkProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
  },
});
