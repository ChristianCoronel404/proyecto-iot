import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text } from 'react-native';
import { useState } from 'react';
import LoginScreen from './LoginScreen';
import DashboardScreen from './DashboardScreen';

export default function App() {
  const [user, setUser] = useState(null);

  if (!user) {
    return (
      <>
        <StatusBar style="light" />
        <LoginScreen onLogin={(data) => setUser(data)} />
      </>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <DashboardScreen user={user} onLogout={() => setUser(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050b14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeText: {
    color: '#78ba49',
    fontSize: 24,
    fontWeight: 'bold',
  }
});
