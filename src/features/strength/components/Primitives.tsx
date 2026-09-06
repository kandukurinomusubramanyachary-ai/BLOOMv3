import React, {type PropsWithChildren} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {tokens} from '../../../theme/tokens';

export function Page({children, footer}: PropsWithChildren<{footer?: React.ReactNode}>) {
  return <SafeAreaView style={s.page} edges={['top', 'bottom']}>
    <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>{children}</ScrollView>
    {footer && <View style={s.footer}>{footer}</View>}
  </SafeAreaView>;
}

export function Button({label, onPress, disabled = false, variant = 'primary', accessibilityLabel}: {
  label: string; onPress: () => void; disabled?: boolean; variant?: 'primary'|'secondary'|'text'; accessibilityLabel?: string;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label}
    accessibilityState={{disabled}} disabled={disabled} onPress={onPress}
    style={({pressed}) => [s.button, variant === 'primary' ? s.primary : variant === 'secondary' ? s.secondary : s.textButton,
      disabled && s.disabled, pressed && !disabled && s.pressed]}>
    <Text style={[s.buttonText, variant === 'primary' && s.onPrimary, disabled && s.disabledText]}>{label}</Text>
  </Pressable>;
}

export function ScreenHeader({title, onBack, right}: {title: string; onBack?: () => void; right?: React.ReactNode}) {
  return <View style={s.header}>
    {onBack && <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack} style={s.back}>
      <Ionicons name="arrow-back" size={22} color={tokens.colors.ink}/>
    </Pressable>}
    <Text accessibilityRole="header" style={s.headerTitle}>{title}</Text>
    {right}
  </View>;
}

export function Eyebrow({children}: PropsWithChildren) {return <Text style={s.eyebrow}>{children}</Text>;}
export function Body({children, centered = false}: PropsWithChildren<{centered?: boolean}>) {
  return <Text style={[s.body, centered && s.center]}>{children}</Text>;
}
export function Section({children, style}: PropsWithChildren<{style?: StyleProp<ViewStyle>}>) {
  return <View style={[s.section, style]}>{children}</View>;
}
export function Notice({title, children}: PropsWithChildren<{title: string}>) {
  return <View style={s.notice} accessibilityLiveRegion="polite"><Text style={s.noticeTitle}>{title}</Text><Body>{children}</Body></View>;
}

const s = StyleSheet.create({
  page: {flex:1, backgroundColor:tokens.colors.canvas}, content:{paddingHorizontal:24,paddingBottom:24,flexGrow:1},
  footer:{paddingHorizontal:24,paddingTop:16,paddingBottom:8,gap:8,borderTopWidth:1,borderTopColor:tokens.colors.line},
  button:{minHeight:52,paddingHorizontal:22,paddingVertical:15,borderRadius:tokens.radius.pill,alignItems:'center',justifyContent:'center'},
  primary:{backgroundColor:tokens.colors.primary},secondary:{borderWidth:1,borderColor:tokens.colors.border,backgroundColor:tokens.colors.white},
  textButton:{backgroundColor:'transparent'},buttonText:{fontSize:16,lineHeight:22,fontWeight:'600',color:tokens.colors.ink},onPrimary:{color:tokens.colors.white},
  disabled:{backgroundColor:tokens.colors.soft,borderColor:tokens.colors.line},disabledText:{color:tokens.colors.muted},pressed:{opacity:.75},
  header:{minHeight:72,flexDirection:'row',alignItems:'center',gap:12},back:{width:48,height:48,borderRadius:24,backgroundColor:tokens.colors.soft,alignItems:'center',justifyContent:'center',marginLeft:-8},
  headerTitle:{fontSize:20,lineHeight:26,fontWeight:'600',color:tokens.colors.ink,flex:1},
  eyebrow:{fontSize:11,lineHeight:16,fontWeight:'700',letterSpacing:1.3,color:tokens.colors.muted},
  body:{fontSize:15,lineHeight:23,color:tokens.colors.muted},center:{textAlign:'center'},section:{marginTop:28,gap:12},
  notice:{padding:18,borderRadius:14,backgroundColor:tokens.colors.soft,gap:6},noticeTitle:{fontSize:15,lineHeight:21,fontWeight:'600',color:tokens.colors.ink},
});
