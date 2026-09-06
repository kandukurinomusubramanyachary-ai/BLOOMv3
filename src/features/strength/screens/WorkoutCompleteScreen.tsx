import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {StrengthStackParamList} from '../navigation/types';
import {Page, Body, Button, Eyebrow} from '../components/Primitives';
import {tokens} from '../../../theme/tokens';

export function WorkoutCompleteScreen({route,navigation}:NativeStackScreenProps<StrengthStackParamList,'WorkoutComplete'>) {
  const {reps,mode,reachedTarget}=route.params;
  return <Page footer={<Button label="Back to Strength" onPress={()=>navigation.popToTop()}/>}>
    <View style={s.content}>
      <View style={s.icon}><Ionicons name="flower-outline" size={50} color={tokens.colors.primary}/></View>
      <Eyebrow>A MOMENT FOR YOU</Eyebrow>
      <Text accessibilityRole="header" style={s.title}>{reachedTarget ? 'You showed up.' : 'A little movement counts.'}</Text>
      <Body centered>{reachedTarget ? 'Your set is complete. Take a breath and enjoy a moment of rest.' : 'You can finish whenever you need to. Thank you for moving with Bloom.'}</Body>
      <View style={s.summary}><Text style={s.reps}>{reps}</Text><Text style={s.label}>squat {reps===1?'repetition':'repetitions'}</Text><Text style={s.mode}>{mode==='manual'?'Logged by you · no form tracking':'Counted with on-device tracking'}</Text></View>
      <Body centered>This session stays here. No video or pose data is saved.</Body>
    </View>
  </Page>;
}
const s=StyleSheet.create({content:{flex:1,justifyContent:'center',alignItems:'center',gap:18,paddingVertical:48},icon:{width:100,height:100,borderRadius:50,backgroundColor:tokens.colors.rose,alignItems:'center',justifyContent:'center',marginBottom:8},title:{fontSize:28,lineHeight:36,fontWeight:'600',letterSpacing:-.5,color:tokens.colors.ink,textAlign:'center'},summary:{alignSelf:'stretch',padding:28,alignItems:'center',borderRadius:20,backgroundColor:tokens.colors.soft,gap:8,marginVertical:12},reps:{fontSize:64,lineHeight:74,fontWeight:'700',color:tokens.colors.ink},label:{fontSize:16,color:tokens.colors.body},mode:{fontSize:12,lineHeight:19,color:tokens.colors.muted,textAlign:'center'}});
