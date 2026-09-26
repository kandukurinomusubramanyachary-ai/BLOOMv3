import React, { useEffect, useRef } from 'react';
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
import { normalizeWaterReminderSettings, waterReminderService } from './src/services/waterReminders';
import { ProductTourProvider, ProductTourOverlay } from './src/components/productTour';

function WaterReminderScheduleGuard() {
  const { state, saveSettings } = useApp();
  const runningRef = useRef(false);
  const water = normalizeWaterReminderSettings(state.settings?.waterReminders);
  const dependencyKey = JSON.stringify(water);

  useEffect(() => {
    if (state.isLoading || runningRef.current) return undefined;
    let active = true;
    runningRef.current = true;
    waterReminderService.reconcileWaterReminders(water)
      .then(async (reconciled) => {
        if (active && JSON.stringify(reconciled) !== dependencyKey) {
          await saveSettings({ waterReminders: reconciled });
        }
      })
      .catch((error) => {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.warn('[Bloom water reminders] Schedule check failed.', error);
        }
      })
      .finally(() => { runningRef.current = false; });
    return () => { active = false; };
  }, [dependencyKey, state.isLoading]);

  return null;
}

function AuthenticatedBloom() {
  const { state } = useApp();
  return (
    <ProductTourProvider>
      <StatusBar style={statusBarStyleForTheme(state.resolvedTheme)} />
      <WaterReminderScheduleGuard />
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
