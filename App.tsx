import React from 'react';
import {NavigationContainer, DefaultTheme} from '@react-navigation/native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {StatusBar} from 'expo-status-bar';
import {StrengthNavigator} from './src/features/strength/navigation/StrengthNavigator';
import {tokens} from './src/theme/tokens';

const theme={...DefaultTheme,colors:{...DefaultTheme.colors,primary:tokens.colors.primary,background:tokens.colors.canvas,card:tokens.colors.canvas,text:tokens.colors.ink,border:tokens.colors.line}};
export default function App() {
  return <SafeAreaProvider><StatusBar style="dark"/><NavigationContainer theme={theme}><StrengthNavigator/></NavigationContainer></SafeAreaProvider>;
}
