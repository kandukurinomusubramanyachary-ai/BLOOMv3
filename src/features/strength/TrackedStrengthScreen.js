import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import { COLORS, SIZES, TYPOGRAPHY } from '../../utils/constants';

// Native tracked-session entry. Bloom's camera pose tracking on native requires
// the local Expo module (modules/bloom-pose-landmarker), which is NOT present in
// this repository. Until that native module exists and autolinks, native users
// are explicitly routed to the camera-free guided session.
export default function TrackedStrengthScreen({ onFallback }) {
  useEffect(() => {
    // Native tracking is unsupported here; surface the guided fallback.
    onFallback?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.wrap}>
        <View style={styles.iconWrap}>
          <Icon name="videocam-off-outline" size={26} color={COLORS.brand} />
        </View>
        <Text style={styles.title}>Camera guidance is available in a development build</Text>
        <Text style={styles.body}>
          Pose tracking on a phone needs the Bloom pose-landmarker native module,
          which is not part of this build. Your camera-free guided session is ready instead.
        </Text>
        <View style={styles.buttonWrap}>
          <Button title="Use guided session" variant="primary" onPress={onFallback} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = {
  safe: { flex: 1, backgroundColor: COLORS.canvas },
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SIZES.lg, gap: SIZES.compact, maxWidth: 520, alignSelf: 'center', width: '100%' },
  iconWrap: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.brandSoft, marginBottom: SIZES.sm },
  title: { ...TYPOGRAPHY.sectionTitle, color: COLORS.ink, textAlign: 'center' },
  body: { ...TYPOGRAPHY.supporting, color: COLORS.muted, textAlign: 'center', maxWidth: 430 },
  buttonWrap: { width: '100%', marginTop: SIZES.md },
};
