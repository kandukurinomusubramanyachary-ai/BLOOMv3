import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {tokens} from '../../../theme/tokens';

export function FormFeedback({message}: {message:string|null}) {
  return <View style={s.box}><Text accessibilityLiveRegion="polite" style={s.text}>{message ?? 'Take your time. Move at your own pace.'}</Text></View>;
}
const s=StyleSheet.create({box:{minHeight:70,justifyContent:'center',padding:16,backgroundColor:tokens.colors.soft,borderRadius:14},text:{fontSize:15,lineHeight:23,color:tokens.colors.body,textAlign:'center'}});
