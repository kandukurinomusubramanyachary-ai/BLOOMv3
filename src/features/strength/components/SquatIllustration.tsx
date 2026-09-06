import React from 'react';
import Svg, {Circle, Ellipse, Path, Rect} from 'react-native-svg';

/** Static exercise illustration; never represents measured pose data. */
export function SquatIllustration({small = false}: {small?: boolean}) {
  return <Svg width="100%" height={small ? 92 : 216} viewBox="0 0 320 216" accessibilityLabel="Illustration of a person practicing a bodyweight squat" accessibilityRole="image">
    <Circle cx="220" cy="91" r="76" fill="#EFDBC9"/>
    <Rect x="32" y="181" width="260" height="8" rx="4" fill="#D8C6B3"/>
    <Path d="M55 178V122M54 152C32 148 33 130 33 130C53 133 55 143 54 152M56 138C80 133 77 116 77 116C58 119 56 128 56 138" fill="#9DA68A" stroke="#8B9875" strokeWidth="3" strokeLinecap="round"/>
    <Path d="M137 122L191 127L175 177" fill="none" stroke="#3F4944" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round"/>
    <Path d="M133 120L104 145L120 177" fill="none" stroke="#536459" strokeWidth="21" strokeLinecap="round" strokeLinejoin="round"/>
    <Path d="M163 67L140 115" stroke="#B94E63" strokeWidth="33" strokeLinecap="round"/>
    <Path d="M170 76L199 99L228 91" fill="none" stroke="#C28B6D" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round"/>
    <Path d="M151 76L177 97L208 86" fill="none" stroke="#DBA88A" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round"/>
    <Path d="M171 51L166 66" stroke="#DBA88A" strokeWidth="12" strokeLinecap="round"/>
    <Circle cx="176" cy="41" r="17" fill="#DBA88A"/>
    <Path d="M161 43C150 27 170 16 182 25C190 27 195 35 190 44L183 36L168 35L166 46Z" fill="#393B36"/>
    <Circle cx="158" cy="28" r="10" fill="#393B36"/>
    <Path d="M112 179H132M168 180H193" stroke="#FDFBF6" strokeWidth="10" strokeLinecap="round"/>
    <Ellipse cx="250" cy="177" rx="18" ry="3" fill="#C9BDA9"/>
    <Rect x="245" y="149" width="11" height="28" rx="4" fill="#839782"/>
    <Rect x="248" y="145" width="5" height="6" rx="1" fill="#536459"/>
  </Svg>;
}
