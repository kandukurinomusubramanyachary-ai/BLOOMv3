import React, { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AppState, Easing, Platform } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';
import { useApp } from '../context/AppContext';
import MainTabNavigator from './MainTabNavigator';
import DayDetailScreen from '../screens/DayDetailScreen';
import LogPeriodScreen from '../screens/LogPeriodScreen';
import PrivacySettingsScreen from '../screens/PrivacySettingsScreen';
import RemindersScreen from '../screens/RemindersScreen';
import ExportDataScreen from '../screens/ExportDataScreen';
import PreferencesScreen from '../screens/PreferencesScreen';
import DailyCheckInScreen from '../screens/DailyCheckInScreen';
import FoodScreen from '../screens/FoodScreen';
import MovementScreen from '../screens/MovementScreen';
import DoctorReportScreen from '../screens/DoctorReportScreen';
import SplashScreen from '../screens/SplashScreen';
import ProfileScreen from '../screens/ProfileScreen';
import LegalScreen from '../screens/LegalScreen';
import OnboardingV3Screen from '../features/onboardingV3/OnboardingV3Screen';
import LearnBloomScreen from '../screens/LearnBloomScreen';
import AppLockModal from '../components/AppLockModal';
const { createAppLockLifecycle } = require('../services/appLockLifecycle');
import { useReducedMotion } from '../components/Motion';
import { COLORS, navigationColorsForTheme } from '../utils/constants';
import { markStartupReady, setStartupStage } from '../diagnostics/startupDiagnostics';

const Stack = createStackNavigator();

export default function RootNavigator() {
  const { state } = useApp();
  const navigationTheme = useMemo(() => ({
    ...DefaultTheme,
    dark: state.resolvedTheme === 'dark',
    colors: navigationColorsForTheme(state.resolvedTheme),
  }), [state.resolvedTheme]);
  const reduceMotion = useReducedMotion();
  const [splashComplete, setSplashComplete] = useState(false);
  const [locked, setLocked] = useState(false);
  const lockLifecycle = useRef(createAppLockLifecycle(AppState.currentState));
  const handleSplashFinish = useCallback(() => setSplashComplete(true), []);
  const handleNavigationReady = useCallback(() => {
    setStartupStage('navigation-ready');
    requestAnimationFrame(() => markStartupReady('first-screen-rendered'));
  }, []);

  useEffect(() => {
    async function handleScreenCapture() {
      if (Platform.OS === 'web') return;
      try {
        if (state.privacy.hidePreview) {
          await ScreenCapture.preventScreenCaptureAsync('bloom-privacy');
        } else {
          await ScreenCapture.allowScreenCaptureAsync('bloom-privacy');
        }
      } catch (error) {
        console.warn('Screen preview protection is unavailable on this device.');
      }
    }
    handleScreenCapture();
  }, [state.privacy.hidePreview]);

  useEffect(() => {
    if (state.privacy.appLockEnabled) {
      setLocked(true);
    }
  }, [state.privacy.appLockEnabled]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (lockLifecycle.current.transition(nextAppState, {
        enabled: state.privacy.appLockEnabled,
        timeoutMinutes: state.privacy.appLockTimeout,
      }).lock) setLocked(true);
    });
    return () => subscription.remove();
  }, [state.privacy.appLockEnabled, state.privacy.appLockTimeout]);

  if (!splashComplete) {
    return (
      <SplashScreen
        ready={!state.isLoading}
        onFinish={handleSplashFinish}
      />
    );
  }

  return (
    <>
      <NavigationContainer
        theme={navigationTheme}
        onReady={handleNavigationReady}
      >
        <Stack.Navigator
          initialRouteName={state.profile?.onboardingCompleted === false ? 'OnboardingV3Preview' : 'Main'}
          screenOptions={{
            headerShown: false,
            cardStyle: { flex: 1, minHeight: 0, backgroundColor: COLORS.canvas },
            animation: reduceMotion ? 'none' : 'default',
            transitionSpec: {
              open: {
                animation: 'timing',
                config: {
                  duration: reduceMotion ? 0 : 210,
                  easing: Easing.bezier(0.23, 1, 0.32, 1),
                },
              },
              close: {
                animation: 'timing',
                config: {
                  duration: reduceMotion ? 0 : 150,
                  easing: Easing.bezier(0.23, 1, 0.32, 1),
                },
              },
            },
            cardStyleInterpolator: ({ current }) => ({
              cardStyle: {
                opacity: current.progress,
                transform: [{
                  translateY: current.progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: reduceMotion ? [0, 0] : [6, 0],
                  }),
                }],
              },
            }),
          }}
        >
          <Stack.Screen name="Main" component={MainTabNavigator} />
          <Stack.Screen name="Legal" component={LegalScreen} />
          <Stack.Screen name="DayDetail" component={DayDetailScreen} />
          <Stack.Screen name="LogPeriod" component={LogPeriodScreen} />
          <Stack.Screen name="PrivacySettings" component={PrivacySettingsScreen} />
          <Stack.Screen name="Reminders" component={RemindersScreen} />
          <Stack.Screen name="ExportData" component={ExportDataScreen} />
          <Stack.Screen name="Preferences" component={PreferencesScreen} />
          <Stack.Screen
            name="DailyCheckIn"
            component={DailyCheckInScreen}
            options={{
              cardStyle: {
                flex: 1,
                overflow: 'hidden',
                backgroundColor: COLORS.canvas,
              },
            }}
          />
          <Stack.Screen name="Food" component={FoodScreen} />
          <Stack.Screen name="Movement" component={MovementScreen} />
          <Stack.Screen
            name="DoctorReport"
            component={DoctorReportScreen}
            options={{
              cardStyle: {
                flex: 1,
                minHeight: 0,
                overflow: 'hidden',
                backgroundColor: COLORS.canvas,
              },
            }}
          />
          <Stack.Screen
            name="Profile"
            component={ProfileScreen}
            options={{
              cardStyle: {
                flex: 1,
                minHeight: 0,
                overflow: 'hidden',
                backgroundColor: COLORS.canvas,
              },
            }}
          />
          <Stack.Screen
            name="OnboardingV3Preview"
            component={OnboardingV3Screen}
            options={{
              cardStyle: {
                flex: 1,
                minHeight: 0,
                backgroundColor: COLORS.canvas,
              },
            }}
          />
          <Stack.Screen name="LearnBloom" component={LearnBloomScreen} />
        </Stack.Navigator>
      </NavigationContainer>

      <AppLockModal visible={locked} onUnlock={() => setLocked(false)} />
    </>
  );
}
