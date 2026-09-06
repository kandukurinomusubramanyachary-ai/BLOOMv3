import React, {useCallback} from 'react';
import {Linking, StyleSheet, Text, View} from 'react-native';
import {useFocusEffect, useIsFocused} from '@react-navigation/native';
import {Ionicons} from '@expo/vector-icons';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {StrengthStackParamList} from '../navigation/types';
import {useStrengthSession} from '../hooks/StrengthTrackingContext';
import {Page, ScreenHeader, Button, Body, Section, Notice} from '../components/Primitives';
import {CameraFrame} from '../components/CameraFrame';
import {tokens} from '../../../theme/tokens';
import type {SetupIssue} from '../session/setupReadiness';

const issueCopy:Record<Exclude<SetupIssue,null>,string>={SEARCHING:'Position yourself so your shoulders, hips, knees and ankles are visible.',LOW_CONFIDENCE:'Try a brighter space and keep your full body in view.',BODY_CLIPPED:'Move back slightly so your full body stays visible.',TOO_FAR:'Move a little closer while keeping your full body in view.'};
export function CameraSetupScreen({navigation}:NativeStackScreenProps<StrengthStackParamList,'CameraSetup'>) {
  const tracking=useStrengthSession();
  const focused=useIsFocused();
  const {activateSetup}=tracking;
  useFocusEffect(useCallback(()=>{activateSetup();},[activateSetup]));
  const {adapterState,readiness}=tracking;
  const granted=adapterState.permission==='GRANTED';
  const blocked=adapterState.permission==='BLOCKED';
  const unavailable=adapterState.status==='UNAVAILABLE';
  const error=adapterState.status==='ERROR'||!!tracking.cameraError;
  const ready=readiness.ready&&adapterState.status==='RUNNING'&&tracking.cameraEnabled;
  const start=()=>{if(tracking.startWorkout())navigation.navigate('LiveWorkout',{mode:'tracked'});};
  const manual=()=>{tracking.deactivate();navigation.navigate('LiveWorkout',{mode:'manual'});};
  return <Page footer={<><Button label="Start workout" disabled={!ready} onPress={start}/><Button label="Continue without camera" variant="text" onPress={manual}/></>}>
    <ScreenHeader title="Find your space" onBack={()=>navigation.goBack()}/>
    <Body>Place your phone on a steady surface. Leave enough room to see your whole body.</Body>
    <Section>
      <CameraFrame enabled={focused&&tracking.cameraEnabled} permissionGranted={granted} nativeTracking={adapterState.available} onError={tracking.failCamera}/>
      {!granted && <Notice title={blocked?'Camera access is turned off':adapterState.permission==='DENIED'?'Camera permission wasn’t granted':'A camera, just for this moment'}>
        Bloom uses your camera to count squats on your device. Video is never recorded or uploaded. You can also move without it.
      </Notice>}
      {!granted && <Button variant="secondary" label={blocked?'Open camera settings':'Allow camera access'} onPress={()=>{if(blocked)void Linking.openSettings().catch(tracking.failCamera);else void tracking.requestPermission();}}/>}
      {unavailable && <Notice title="Live tracking isn’t available in this build">You can try the camera preview or continue with a manual set. Repetitions and form won’t be detected.</Notice>}
      {error && <Notice title="Let’s try that again">{tracking.cameraError ?? 'Tracking couldn’t start. Try again or continue without the camera.'}</Notice>}
      {(error||unavailable) && <Button label="Retry camera tracking" variant="secondary" onPress={tracking.retry}/>}
    </Section>
    <Section>
      <Text accessibilityRole="header" style={s.heading}>{ready?'You’re in view. Ready when you are.':'A little room makes a difference.'}</Text>
      <Body>{readiness.issue?issueCopy[readiness.issue]:'Stay in view for a moment while we find your position.'}</Body>
      <View style={s.checks}>{(Object.keys(readiness.groups) as (keyof typeof readiness.groups)[]).map(group=><View key={group} style={s.check} accessible accessibilityLabel={`${group}: ${readiness.groups[group]?'visible':'not yet visible'}`}>
        <Ionicons name={readiness.groups[group]?'checkmark-circle':'ellipse-outline'} size={20} color={readiness.groups[group]?tokens.colors.sage:tokens.colors.muted}/><Text style={s.checkLabel}>{group[0].toUpperCase()+group.slice(1)}</Text>
      </View>)}</View>
    </Section>
  </Page>;
}
const s=StyleSheet.create({heading:{fontSize:18,lineHeight:25,fontWeight:'600',color:tokens.colors.ink},checks:{flexDirection:'row',flexWrap:'wrap',rowGap:16,paddingTop:4},check:{flexDirection:'row',alignItems:'center',gap:8,width:'50%'},checkLabel:{fontSize:14,lineHeight:20,color:tokens.colors.body}});
