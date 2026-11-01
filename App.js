import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AppProvider, useApp } from './src/context/AppContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import AuthScreen from './src/screens/AuthScreen';
import SplashScreen from './src/screens/SplashScreen';
import StartupDiagnosticScreen from './src/components/StartupDiagnosticScreen';
import { markStartupReady } from './src/diagnostics/startupDiagnostics';
import { setActiveTheme, statusBarStyleForTheme } from './src/utils/constants';
import DeviceFrame, { SafeAreaShim } from './src/components/DeviceFrame';
import { reminderCoordinator } from './src/services/reminderCoordinator';
import { ProductTourProvider, ProductTourOverlay } from './src/components/productTour';

function ReminderScheduleGuard() {
  const { user } = useAuth();
  const { state } = useApp();
  const dependencyKey=JSON.stringify({reminders:state.settings?.reminders,waterReminders:state.settings?.waterReminders});
  useEffect(() => {
    if(state.isLoading||state.profile?.deletionPending)return undefined;
    let active=true;
    const reconcile=()=>{if(active)void reminderCoordinator.reconcile(user?.uid,state.settings).catch(()=>undefined);};
    void reminderCoordinator.setOwner(user?.uid).then(reconcile).catch(()=>undefined);
    const sub=AppState.addEventListener('change',value=>{if(value==='active')reconcile();});
    return()=>{active=false;sub.remove();};
  },[user?.uid,dependencyKey,state.isLoading,state.profile?.deletionPending]);
  return null;
}

function AuthenticatedBloom() {
  const { state } = useApp();
  return (
    <ProductTourProvider>
      <StatusBar style={statusBarStyleForTheme(state.resolvedTheme)} />
      <ReminderScheduleGuard />
      <RootNavigator />
      <ProductTourOverlay />
    </ProductTourProvider>
  );
}

function BloomEntry() {
  const {
    user,
    initializing,
    retryStartup,
    startupFailure,
  } = useAuth();

  if (!user) setActiveTheme('light');

  useEffect(() => {
    if (!initializing && !user && !startupFailure) {
      markStartupReady();
    }
  }, [initializing, startupFailure, user]);

  if (startupFailure) {
    return (
      <StartupDiagnosticScreen
        failure={startupFailure}
        onRetry={retryStartup}
      />
    );
  }

  if (initializing) {
    return (
      <>
        <StatusBar style='dark' />
        <SplashScreen ready={false} onFinish={() => {}} />
      </>
    );
  }

  if (!user) {
    return (
      <>
        <StatusBar style='dark' />
        <AuthScreen />
      </>
    );
  }

  return (
    <AppProvider key={user.uid}>
      <AuthenticatedBloom />
    </AppProvider>
  );
}

export default function App() {
  return (
    <DeviceFrame>
      <SafeAreaShim>
        <AuthProvider>
          <BloomEntry />
        </AuthProvider>
      </SafeAreaShim>
    </DeviceFrame>
  );
}
