import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './screens/LoginScreen';
import Dashboard from './screens/Dashboard';
import NotificationsScreen from './screens/NotificationsScreen';
import MapScreen from './screens/MapScreen';
import RoundDetailScreen from './screens/RoundDetailScreen';
import HistoryScreen from './screens/HistoryScreen';
import GuardiaProfileScreen from './screens/GuardiaProfileScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }} id="RootNavigator">
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Dashboard" component={Dashboard} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="MapScreen" component={MapScreen} />
        <Stack.Screen name="RoundDetailScreen" component={RoundDetailScreen} />
        <Stack.Screen name="HistoryScreen" component={HistoryScreen} />
        <Stack.Screen name="GuardiaProfileScreen" component={GuardiaProfileScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
