import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {tokens} from '../../../theme/tokens';

export function WorkoutCard({name, detail, icon}: {name:string;detail:string;icon:React.ComponentProps<typeof Ionicons>['name']}) {
  return <View style={s.row} accessible accessibilityLabel={`${name}. Coming soon. ${detail}`}>
    <View style={s.icon}><Ionicons name={icon} size={22} color={tokens.colors.muted}/></View>
    <View style={s.copy}><Text style={s.name}>{name}</Text><Text style={s.detail}>{detail}</Text></View>
    <Text style={s.badge}>Coming soon</Text>
  </View>;
}
const s=StyleSheet.create({row:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:16,borderBottomWidth:1,borderBottomColor:tokens.colors.line},icon:{width:44,height:44,borderRadius:14,backgroundColor:tokens.colors.soft,alignItems:'center',justifyContent:'center'},copy:{flex:1,gap:3},name:{fontSize:15,fontWeight:'600',lineHeight:21,color:tokens.colors.ink},detail:{fontSize:12,lineHeight:18,color:tokens.colors.muted},badge:{fontSize:10,lineHeight:15,color:tokens.colors.muted,backgroundColor:tokens.colors.soft,paddingHorizontal:9,paddingVertical:5,borderRadius:20}});
