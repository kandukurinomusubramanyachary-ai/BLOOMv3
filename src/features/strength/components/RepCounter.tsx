import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {tokens} from '../../../theme/tokens';

export function RepCounter({reps, target, manual = false}: {reps:number;target:number;manual?:boolean}) {
  return <View style={s.container} accessible accessibilityLabel={`${reps} of ${target} repetitions${manual ? ', entered manually' : ''}`} accessibilityLiveRegion="polite">
    <Text style={s.label}>SET 1</Text>
    <Text style={s.reps}>{reps}<Text style={s.target}> / {target}</Text></Text>
    <Text style={s.caption}>{manual ? 'Repetitions you’ve logged' : 'Repetitions detected'}</Text>
  </View>;
}
const s=StyleSheet.create({container:{alignItems:'center',paddingVertical:20,gap:4},label:{fontSize:11,fontWeight:'700',letterSpacing:1.5,color:tokens.colors.muted},reps:{fontSize:64,lineHeight:76,fontWeight:'700',letterSpacing:-2,color:tokens.colors.ink,fontVariant:['tabular-nums']},target:{fontSize:28,fontWeight:'400',color:tokens.colors.muted,letterSpacing:0},caption:{fontSize:13,lineHeight:19,color:tokens.colors.muted}});
