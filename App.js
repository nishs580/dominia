import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, Text, View } from 'react-native';
import ActivityScreen from './screens/ActivityScreen';
import ProfileScreen from './screens/ProfileScreen';

const Tab = createBottomTabNavigator();

function PlaceholderScreen({ label }) {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{label}</Text>
    </View>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator screenOptions={{ headerTitleAlign: 'center' }}>
        <Tab.Screen
          name="Map"
          options={{ title: 'Map' }}
          children={() => <PlaceholderScreen label="Map" />}
        />
        <Tab.Screen
          name="Activity"
          options={{ title: 'Activity' }}
          component={ActivityScreen}
        />
        <Tab.Screen
          name="Alliance"
          options={{ title: 'Alliance' }}
          children={() => <PlaceholderScreen label="Alliance" />}
        />
        <Tab.Screen
          name="Profile"
          options={{ title: 'Profile' }}
          component={ProfileScreen}
        />
      </Tab.Navigator>
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
