import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {TrackingStatus as Status} from '../pose/types';
import {tokens} from '../../../theme/tokens';

const labels:Record<Status,string>={INITIALIZING:'Getting ready',TRACKING:'Tracking your movement',LOW_CONFIDENCE:'Finding a clearer view',NO_POSE:'Step into view',UNAVAILABLE:'Tracking unavailable'};
export function TrackingStatus({status}: {status:Status}) {
  return <View style={s.row} accessibilityLiveRegion="polite"><View style={[s.dot,status==='TRACKING'&&s.active]}/><Text style={s.label}>{labels[status]}</Text></View>;
}
const s=StyleSheet.create({row:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,paddingVertical:10},dot:{width:6,height:6,borderRadius:3,backgroundColor:tokens.colors.muted},active:{backgroundColor:tokens.colors.sage},label:{fontSize:13,lineHeight:19,color:tokens.colors.muted}});
