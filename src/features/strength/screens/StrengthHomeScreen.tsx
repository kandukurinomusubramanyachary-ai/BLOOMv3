import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {StrengthStackParamList} from '../navigation/types';
import {tokens} from '../../../theme/tokens';
import {Page, Button, Body, Section, Eyebrow} from '../components/Primitives';
import {SquatIllustration} from '../components/SquatIllustration';
import {WorkoutCard} from '../components/WorkoutCard';
import {SQUAT_CONFIG} from '../exercises/squat/squat.config';

export function StrengthHomeScreen({navigation}:NativeStackScreenProps<StrengthStackParamList,'StrengthHome'>) {
  return <Page footer={<Button label="Start Squat" onPress={()=>navigation.navigate('CameraSetup')}/>}>
    <View style={s.brand}><Ionicons name="flower-outline" size={26} color={tokens.colors.primary}/><Text style={s.brandName}>bloom</Text><Text style={s.brandNote}>A LITTLE STRONGER, TOGETHER</Text></View>
    <View style={s.intro}><Eyebrow>MOVE WITH BLOOM</Eyebrow><Text accessibilityRole="header" style={s.title}>Strength, at your pace.</Text><Body>A little space. Your own body. A moment for you.</Body></View>
    <Section>
      <View style={s.sectionHead}><Text accessibilityRole="header" style={s.sectionTitle}>Today’s workout</Text><Text style={s.subtle}>Bodyweight</Text></View>
      <View style={s.hero}>
        <View style={s.heroBadge}><Ionicons name="scan-outline" size={13} color={tokens.colors.ink}/><Text style={s.heroBadgeText}>Squat tracking supported</Text></View>
        <SquatIllustration/>
      </View>
      <View style={s.workoutHeading}><View style={s.workoutCopy}><Text style={s.workoutTitle}>The everyday squat</Text><Text style={s.subtle}>Build a foundation, one repetition at a time.</Text></View><View style={s.arrow}><Ionicons name="arrow-forward" size={20} color={tokens.colors.primary}/></View></View>
      <View style={s.stats}>
        <Stat value="1" label="set"/>
        <Stat value={String(SQUAT_CONFIG.targetReps)} label="repetitions"/>
        <Stat value="None" label="equipment"/>
      </View>
      <View style={s.privacy}><Ionicons name="shield-checkmark-outline" size={18} color={tokens.colors.sage}/><Text style={s.privacyText}>Your movement stays yours. No video is saved.</Text></View>
    </Section>
    <Section>
      <Text accessibilityRole="header" style={s.sectionTitle}>More ways to move</Text>
      <Body>We’re making room for what’s next.</Body>
      <View>
        <WorkoutCard name="Push-up" detail="Upper-body strength" icon="fitness-outline"/>
        <WorkoutCard name="Glute Bridge" detail="Hips & glutes" icon="leaf-outline"/>
        <WorkoutCard name="Reverse Lunge" detail="Balance & lower body" icon="walk-outline"/>
        <WorkoutCard name="Plank" detail="Core & stability" icon="remove-outline"/>
      </View>
    </Section>
    <Text style={s.note}>No rush. No rankings. Just you, showing up.</Text>
    {__DEV__ && <Button label="Developer · Pose simulator" variant="text" onPress={()=>navigation.navigate('StrengthDeveloper')}/>}
  </Page>;
}
function Stat({value,label}:{value:string;label:string}) {return <View style={s.stat}><Text style={s.statValue}>{value}</Text><Text style={s.statLabel}>{label}</Text></View>;}
const s=StyleSheet.create({
  brand:{minHeight:72,flexDirection:'row',alignItems:'center',gap:5},brandName:{fontSize:26,fontWeight:'600',letterSpacing:-1,color:tokens.colors.primary},brandNote:{marginLeft:'auto',fontSize:7,fontWeight:'600',letterSpacing:.7,color:tokens.colors.muted},
  intro:{gap:9,paddingTop:18},title:{fontSize:28,lineHeight:36,fontWeight:'600',letterSpacing:-.65,color:tokens.colors.ink},sectionHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  sectionTitle:{fontSize:20,lineHeight:26,fontWeight:'600',letterSpacing:-.25,color:tokens.colors.ink},subtle:{fontSize:12,lineHeight:19,color:tokens.colors.muted},
  hero:{backgroundColor:tokens.colors.peach,borderRadius:20,overflow:'hidden',paddingTop:30},heroBadge:{position:'absolute',left:14,top:14,zIndex:1,flexDirection:'row',gap:5,alignItems:'center',backgroundColor:tokens.colors.white,paddingHorizontal:10,paddingVertical:6,borderRadius:20},heroBadgeText:{fontSize:10,fontWeight:'600',color:tokens.colors.ink},
  workoutHeading:{flexDirection:'row',alignItems:'center',gap:8,paddingTop:4},workoutCopy:{flex:1,gap:4},workoutTitle:{fontSize:18,lineHeight:24,fontWeight:'600',color:tokens.colors.ink},arrow:{height:40,width:40,borderRadius:20,backgroundColor:tokens.colors.rose,alignItems:'center',justifyContent:'center'},
  stats:{flexDirection:'row',backgroundColor:tokens.colors.soft,borderRadius:14,paddingVertical:17,marginTop:4},stat:{flex:1,alignItems:'center',gap:3},statValue:{fontSize:17,fontWeight:'600',color:tokens.colors.ink},statLabel:{fontSize:11,lineHeight:17,color:tokens.colors.muted},
  privacy:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:6},privacyText:{fontSize:11,lineHeight:18,color:tokens.colors.muted,flex:1},note:{fontSize:12,lineHeight:20,textAlign:'center',color:tokens.colors.muted,marginTop:32},
});
