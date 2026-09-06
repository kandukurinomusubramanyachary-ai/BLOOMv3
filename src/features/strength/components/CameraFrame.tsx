import React, {useEffect, useMemo} from 'react';
import {StyleSheet, Text, View, type ViewProps} from 'react-native';
import {CameraView} from 'expo-camera';
import {requireNativeViewManager} from 'expo-modules-core';
import {Ionicons} from '@expo/vector-icons';
import {tokens} from '../../../theme/tokens';

export function CameraFrame({enabled,permissionGranted,nativeTracking,onError}: {
  enabled:boolean;permissionGranted:boolean;nativeTracking:boolean;onError:()=>void;
}) {
  const NativePreview=useMemo(()=>{
    if(!nativeTracking)return null;
    try{return requireNativeViewManager<ViewProps>('BloomPoseLandmarker');}catch{return null;}
  },[nativeTracking]);
  useEffect(()=>{if(nativeTracking&&!NativePreview)onError();},[nativeTracking,NativePreview,onError]);
  const visible=enabled&&permissionGranted;
  return <View style={s.frame} accessibilityLabel={visible?'Live camera preview':'Camera preview is off'}>
    {visible ? nativeTracking ? NativePreview&&<NativePreview style={StyleSheet.absoluteFill}/>
      : <CameraView style={StyleSheet.absoluteFill} facing="front" mirror onMountError={onError}/>
      : <View style={s.empty}><Ionicons name="body-outline" size={74} color="#B9C1B4"/><Text style={s.emptyText}>{permissionGranted?'Camera paused':'Your space to move'}</Text></View>}
    <View pointerEvents="none" style={s.guide}/>
    <View style={s.label}><Ionicons name="lock-closed-outline" size={12} color={tokens.colors.white}/><Text style={s.labelText}>{nativeTracking?'ON YOUR DEVICE':'CAMERA PREVIEW · NO TRACKING'}</Text></View>
  </View>;
}
const s=StyleSheet.create({frame:{height:300,borderRadius:20,backgroundColor:tokens.colors.camera,overflow:'hidden'},empty:{flex:1,alignItems:'center',justifyContent:'center',gap:12},emptyText:{fontSize:13,color:'#CFD4CB'},guide:{position:'absolute',top:26,bottom:45,left:'21%',right:'21%',borderWidth:1,borderColor:'#FFFFFF70',borderRadius:60},label:{position:'absolute',bottom:13,alignSelf:'center',backgroundColor:'#222222BA',borderRadius:20,paddingHorizontal:10,paddingVertical:6,flexDirection:'row',gap:5,alignItems:'center'},labelText:{fontSize:8,lineHeight:12,letterSpacing:.8,fontWeight:'600',color:tokens.colors.white}});
