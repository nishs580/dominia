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
import ActiveClaimScreen from './screens/ActiveClaimScreen';
import ClaimSuccessScreen from './screens/ClaimSuccessScreen';
import ContestResultScreen from './screens/ContestResultScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import AllianceJoinedScreen from './screens/AllianceJoinedScreen';
import CreateAllianceScreen from './screens/CreateAllianceScreen';
import SignInScreen from './screens/SignInScreen';
import UsernameScreen from './screens/UsernameScreen';
import WarRoomScreen from './screens/WarRoomScreen';
import AuthGate from './components/AuthGate';
import { useFonts } from 'expo-font';
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

const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: {
          backgroundColor: '#0E1014',
          borderTopWidth: 1,
          borderTopColor: 'rgba(242,238,230,0.16)',
          elevation: 0,
        },
        tabBarActiveTintColor: '#F2EEE6',
        tabBarInactiveTintColor: '#5C6068',
        tabBarShowIcon: false,
        tabBarLabelStyle: {
          fontFamily: 'GeistMono_400Regular',
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: 1.4,
          includeFontPadding: false,
          marginTop: -14,
        },
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Map"
        options={{
          tabBarLabel: ({ focused, color }) => (
            <Text
              style={{
                fontFamily: focused
                  ? 'GeistMono_500Medium'
                  : 'GeistMono_400Regular',
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: 1.4,
                includeFontPadding: false,
                marginTop: -14,
                color,
              }}
            >
              MAP
            </Text>
          ),
          tabBarIcon: () => null,
        }}
        component={MapScreen}
      />
      <Tab.Screen
        name="Activity"
        options={{
          tabBarLabel: ({ focused, color }) => (
            <Text
              style={{
                fontFamily: focused
                  ? 'GeistMono_500Medium'
                  : 'GeistMono_400Regular',
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: 1.4,
                includeFontPadding: false,
                marginTop: -14,
                color,
              }}
            >
              ACTIVITY
            </Text>
          ),
          tabBarIcon: () => null,
        }}
        component={ActivityScreen}
      />
      <Tab.Screen
        name="Alliance"
        options={{
          tabBarLabel: ({ focused, color }) => (
            <Text
              style={{
                fontFamily: focused
                  ? 'GeistMono_500Medium'
                  : 'GeistMono_400Regular',
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: 1.4,
                includeFontPadding: false,
                marginTop: -14,
                color,
              }}
            >
              ALLIANCE
            </Text>
          ),
          tabBarIcon: () => null,
        }}
        component={AllianceScreen}
      />
      <Tab.Screen
        name="Profile"
        options={{
          tabBarLabel: ({ focused, color }) => (
            <Text
              style={{
                fontFamily: focused
                  ? 'GeistMono_500Medium'
                  : 'GeistMono_400Regular',
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: 1.4,
                includeFontPadding: false,
                marginTop: -14,
                color,
              }}
            >
              PROFILE
            </Text>
          ),
          tabBarIcon: () => null,
        }}
        component={ProfileScreen}
      />
    </Tab.Navigator>
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
      <NavigationContainer>
        <Stack.Navigator initialRouteName="AuthGate" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="AuthGate" component={AuthGate} />
          <Stack.Screen name="SignIn" component={SignInScreen} />
          <Stack.Screen name="Username" component={UsernameScreen} />
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="MainTabs" component={TabNavigator} />
          <Stack.Screen
            name="WarRoom"
            component={WarRoomScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen name="ActiveClaim" component={ActiveClaimScreen} options={{ headerShown: false, tabBarStyle: { display: 'none' } }} />
          <Stack.Screen name="ClaimSuccessScreen" component={ClaimSuccessScreen} options={{ headerShown: false, tabBarStyle: { display: 'none' } }} />
          <Stack.Screen name="ContestResultScreen" component={ContestResultScreen} options={{ headerShown: false, tabBarStyle: { display: 'none' } }} />
          <Stack.Screen name="AllianceJoined" component={AllianceJoinedScreen} options={{ headerShown: false, tabBarStyle: { display: 'none' } }} />
          <Stack.Screen name="CreateAlliance" component={CreateAllianceScreen} options={{ headerShown: false }} />
        </Stack.Navigator>
        <StatusBar style="auto" />
      </NavigationContainer>
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
