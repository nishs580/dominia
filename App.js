import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ClerkProvider } from '@clerk/clerk-expo';
import { tokenCache } from './lib/clerk';
import { StyleSheet, Text, View } from 'react-native';
import ActivityScreen from './screens/ActivityScreen';
import ProfileScreen from './screens/ProfileScreen';
import AllianceScreen from './screens/AllianceScreen';
import MapScreen from './screens/MapScreen';
import GuidedDemo from './components/GuidedDemo';
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
import SignInScreen from './screens/SignInScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import UsernameScreen from './screens/UsernameScreen';
import WarRoomScreen from './screens/WarRoomScreen';
import CommandPostScreen from './screens/CommandPostScreen';
import ActivityLogScreen from './screens/ActivityLogScreen';
import LeaderboardsScreen from './screens/LeaderboardsScreen';
import ChatScreen from './screens/ChatScreen';
import PublicProfileScreen from './screens/PublicProfileScreen';
import AuthGate from './components/AuthGate';
import ActivitySyncLifecycle from './components/ActivitySyncLifecycle';
import FcmLifecycle from './components/FcmLifecycle';
import StreakBreakLifecycle from './components/StreakBreakLifecycle';
import { navigationRef, onNavigationReady } from './lib/navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  MapGlyph,
  ActivityGlyph,
  AllianceGlyph,
  ProfileGlyph,
} from './components/ResourceGlyphs';
import Toast from 'react-native-toast-message';
import NotificationCard from './components/notifications/NotificationCard';
import { useFonts } from 'expo-font';
import { useTranslation } from 'react-i18next';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
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
  Inter_400Regular,
  Inter_500Medium,
} from '@expo-google-fonts/inter';

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

function makeTabOptions(label, Icon) {
  return {
    tabBarIcon: ({ color }) => <Icon size={20} color={color} />,
    tabBarLabel: ({ focused, color }) => (
      <Text
        style={{
          fontFamily: focused ? 'GeistMono_500Medium' : 'GeistMono_400Regular',
          fontSize: 10,
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

const TabNavigator = () => {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
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
      <Tab.Screen name="Map" options={makeTabOptions(t('tabs.map'), MapGlyph)} component={MapScreen} />
      <Tab.Screen name="Activity" options={makeTabOptions(t('tabs.activity'), ActivityGlyph)} component={ActivityScreen} />
      <Tab.Screen name="Alliance" options={makeTabOptions(t('tabs.alliance'), AllianceGlyph)} component={AllianceScreen} />
      <Tab.Screen name="Profile" options={makeTabOptions(t('tabs.profile'), ProfileGlyph)} component={ProfileScreen} />
    </Tab.Navigator>
    <GuidedDemo />
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
    Inter_400Regular,
    Inter_500Medium,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ClerkProvider
      publishableKey="pk_test_bGVuaWVudC1nb29zZS01My5jbGVyay5hY2NvdW50cy5kZXYk"
      tokenCache={tokenCache}
    >
      <ActivitySyncLifecycle />
      <FcmLifecycle />
      <StreakBreakLifecycle />
      <NavigationContainer ref={navigationRef} onReady={onNavigationReady}>
        <Stack.Navigator initialRouteName="AuthGate" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="AuthGate" component={AuthGate} />
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
        <StatusBar style="auto" />
      </NavigationContainer>
      <NotificationCard />
      <Toast />
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
