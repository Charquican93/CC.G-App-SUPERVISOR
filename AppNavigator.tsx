import * as React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginScreen from './screens/LoginScreen';
import Dashboard from './screens/Dashboard';
import NotificationsScreen from './screens/NotificationsScreen';
import MapScreen from './screens/MapScreen';
import RoundDetailScreen from './screens/RoundDetailScreen';
import HistoryScreen from './screens/HistoryScreen';
import GuardiaProfileScreen from './screens/GuardiaProfileScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const [isLoading, setIsLoading] = React.useState(true);
  const [initialRoute, setInitialRoute] = React.useState('Login');
  const [initialParams, setInitialParams] = React.useState<any>(undefined);

  React.useEffect(() => {
    const checkSession = async () => {
      try {
        const session = await AsyncStorage.getItem('userSession');
        console.log('Sesión recuperada al inicio:', session ? 'SÍ' : 'NO');
        if (session) {
          const supervisor = JSON.parse(session);
          setInitialParams({ supervisor });
          setInitialRoute('Dashboard');
        }
      } catch (e) {
        console.error('Error al recuperar sesión:', e);
      } finally {
        setIsLoading(false);
      }
    };
    checkSession();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }} id="RootNavigator">
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Dashboard" component={Dashboard} initialParams={initialParams} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="MapScreen" component={MapScreen} />
        <Stack.Screen name="RoundDetailScreen" component={RoundDetailScreen} />
        <Stack.Screen name="HistoryScreen" component={HistoryScreen} />
        <Stack.Screen name="GuardiaProfileScreen" component={GuardiaProfileScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
