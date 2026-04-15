import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import ActivityScreen from './screens/ActivityScreen';
import ProfileScreen from './screens/ProfileScreen';
import AllianceScreen from './screens/AllianceScreen';
import MapScreen from './screens/MapScreen';
import ActiveClaimScreen from './screens/ActiveClaimScreen';
import ClaimSuccessScreen from './screens/ClaimSuccessScreen';
import ContestResultScreen from './screens/ContestResultScreen';

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
    <Tab.Navigator screenOptions={{ headerTitleAlign: 'center' }}>
      <Tab.Screen
        name="Map"
        options={{ title: 'Map' }}
        component={MapScreen}
      />
      <Tab.Screen
        name="Activity"
        options={{ title: 'Activity' }}
        component={ActivityScreen}
      />
      <Tab.Screen
        name="Alliance"
        options={{ title: 'Alliance' }}
        component={AllianceScreen}
      />
      <Tab.Screen
        name="Profile"
        options={{ title: 'Profile' }}
        component={ProfileScreen}
      />
    </Tab.Navigator>
  );
};

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs" component={TabNavigator} />
        <Stack.Screen
          name="ActiveClaim"
          component={ActiveClaimScreen}
          options={{ headerShown: false, tabBarStyle: { display: 'none' } }}
        />
        <Stack.Screen
          name="ClaimSuccessScreen"
          component={ClaimSuccessScreen}
          options={{ headerShown: false, tabBarStyle: { display: 'none' } }}
        />
        <Stack.Screen
          name="ContestResultScreen"
          component={ContestResultScreen}
          options={{ headerShown: false, tabBarStyle: { display: 'none' } }}
        />
      </Stack.Navigator>
      <StatusBar style="auto" />
    </NavigationContainer>
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
