import React, {useCallback} from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {StrengthStackParamList} from './types';
import {StrengthHomeScreen} from '../screens/StrengthHomeScreen';
import {CameraSetupScreen} from '../screens/CameraSetupScreen';
import {LiveWorkoutScreen} from '../screens/LiveWorkoutScreen';
import {WorkoutCompleteScreen} from '../screens/WorkoutCompleteScreen';
import {StrengthTrackingProvider,useStrengthSession} from '../hooks/StrengthTrackingContext';

const Stack=createNativeStackNavigator<StrengthStackParamList>();
// Metro eliminates this branch in production; fixtures never enter normal flows.
const DeveloperScreen = __DEV__ ? require('../testing/StrengthDeveloperScreen').StrengthDeveloperScreen : null;

function HomeRoute(props:NativeStackScreenProps<StrengthStackParamList,'StrengthHome'>) {
  const {deactivate}=useStrengthSession();
  useFocusEffect(useCallback(()=>{deactivate();},[deactivate]));
  return <StrengthHomeScreen {...props}/>;
}
export function StrengthNavigator() {
  return <StrengthTrackingProvider><Stack.Navigator screenOptions={{headerShown:false,animation:'none',contentStyle:{backgroundColor:'#FFFFFF'}}}>
    <Stack.Screen name="StrengthHome" component={HomeRoute}/>
    <Stack.Screen name="CameraSetup" component={CameraSetupScreen}/>
    <Stack.Screen name="LiveWorkout" component={LiveWorkoutScreen} options={{gestureEnabled:false}}/>
    <Stack.Screen name="WorkoutComplete" component={WorkoutCompleteScreen} options={{gestureEnabled:false}}/>
    {__DEV__&&DeveloperScreen&&<Stack.Screen name="StrengthDeveloper" component={DeveloperScreen}/>}
  </Stack.Navigator></StrengthTrackingProvider>;
}
