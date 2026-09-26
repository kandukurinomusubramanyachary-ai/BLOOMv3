import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LotusMark } from '../BrandMark';
import { COLORS, createThemedStyles } from '../../utils/constants';
import { useProductTour } from './ProductTourContext';
import { GUIDE_METADATA } from './tourSteps';

const CARD_WIDTH = 320;
const GAP = 14;
const EDGE = 16;

export default function ProductTourOverlay() {
  const tour = useProductTour();
  const { visible, invitation, finalVisible, recommendation, currentTourStep, steps, targetsRef, next, back, skip, finish, acceptInvitation, declineInvitation, runRecommendation, reduceMotion } = tour;
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [spotlight, setSpotlight] = useState(null);
  const [placement, setPlacement] = useState('below');
  const [cardSize, setCardSize] = useState({ width: 0, height: 0 });
  const cardRef = useRef(null);
  const step = steps[currentTourStep];

  const measureTarget = useCallback(() => {
    if (!step || finalVisible) return;
    const node = targetsRef.current.get(step.id)?.current;
    if (!node) { setSpotlight(null); return; }
    const apply = (x, y, targetWidth, targetHeight) => {
      if (!targetWidth || !targetHeight) return;
      const padding = 7;
      const area = {
        x: Math.max(4, x - padding),
        y: Math.max(4, y - padding),
        width: Math.min(width - 8, targetWidth + padding * 2),
        height: Math.min(height - 8, targetHeight + padding * 2),
      };
      setSpotlight(area);
      const measuredCardHeight = cardSize.height || 174;
      const roomBelow = height - (area.y + area.height) - Math.max(insets.bottom, EDGE) - GAP;
      setPlacement(roomBelow >= measuredCardHeight || area.y < measuredCardHeight ? 'below' : 'above');
    };
    try {
      if (Platform.OS === 'web' && typeof node.getBoundingClientRect === 'function') {
        const rect = node.getBoundingClientRect();
        if (rect.top < 0 || rect.bottom > height) {
          node.scrollIntoView?.({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center', inline: 'nearest' });
          requestAnimationFrame(() => requestAnimationFrame(measureTarget));
          return;
        }
        apply(rect.x, rect.y, rect.width, rect.height);
      } else if (typeof node.measureInWindow === 'function') {
        node.measureInWindow((x, y, targetWidth, targetHeight) => apply(x, y, targetWidth, targetHeight));
      }
    } catch { setSpotlight(null); }
  }, [cardSize.height, finalVisible, height, insets.bottom, reduceMotion, step, targetsRef, width]);

  useEffect(() => {
    if (!visible || finalVisible) return undefined;
    setSpotlight(null);
    const frame = requestAnimationFrame(() => requestAnimationFrame(measureTarget));
    const onResize = () => measureTarget();
    if (Platform.OS === 'web') window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(frame); if (Platform.OS === 'web') window.removeEventListener('resize', onResize); };
  }, [currentTourStep, finalVisible, measureTarget, visible]);

  useEffect(() => {
    if (!visible || !step || finalVisible) return undefined;
    AccessibilityInfo.announceForAccessibility?.(`${step.title}. Step ${currentTourStep + 1} of ${steps.length}.`);
    return undefined;
  }, [currentTourStep, finalVisible, step, steps.length, visible]);

  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return undefined;
    const onKeyDown = event => {
      if (event.key === 'Escape') skip();
      if (event.key === 'ArrowRight') next();
      if (event.key === 'ArrowLeft' && currentTourStep > 0) back();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [back, currentTourStep, next, skip, visible]);

  if (!visible && !invitation) return null;
  if (invitation && !visible) {
    const meta = GUIDE_METADATA[invitation.tourId] || GUIDE_METADATA.appOverview;
    const isOverview = invitation.tourId === 'appOverview';
    return <View style={styles.invitationWrap} pointerEvents='box-none'>
      <View style={styles.invitationCard} accessibilityRole='alert' accessibilityViewIsModal>
        <Text style={styles.invitationTitle}>{meta.title}</Text>
        <Text style={styles.invitationBody}>{meta.body} <Text style={styles.duration}>{meta.duration}</Text></Text>
        <View style={styles.invitationActions}>
          <Pressable onPress={declineInvitation} accessibilityRole='button' accessibilityLabel={isOverview ? 'No thanks' : 'Skip guide'} style={styles.invitationSecondary}><Text style={styles.secondaryText}>{isOverview ? 'No thanks' : 'Skip'}</Text></Pressable>
          <Pressable onPress={acceptInvitation} accessibilityRole='button' accessibilityLabel={isOverview ? 'Show me around' : 'Show me'} style={styles.primaryButton}><Text style={styles.primaryText}>{isOverview ? 'Show me around' : 'Show me'}</Text></Pressable>
        </View>
      </View>
    </View>;
  }

  const cardWidth = Math.min(CARD_WIDTH, width - EDGE * 2);
  const cardLeft = Math.max(EDGE, Math.min(width - cardWidth - EDGE, ((spotlight?.x || width / 2) + (spotlight?.width || 0) / 2) - cardWidth / 2));
  const cardHeight = finalVisible ? 232 : cardSize.height || 174;
  let cardTop = (height - cardHeight) / 2;
  if (!finalVisible && spotlight) {
    cardTop = placement === 'below' ? spotlight.y + spotlight.height + GAP : spotlight.y - cardHeight - GAP;
    cardTop = Math.max(Math.max(insets.top, EDGE), Math.min(height - cardHeight - Math.max(insets.bottom, EDGE), cardTop));
  }

  return <View style={StyleSheet.absoluteFill} pointerEvents='box-none' accessibilityViewIsModal accessibilityLabel='Bloom product tour'>
    {spotlight && !finalVisible ? <Svg style={StyleSheet.absoluteFill} pointerEvents='none' width={width} height={height}>
      <Defs><Mask id='bloom-tour-mask'><Rect x='0' y='0' width={width} height={height} fill='white' /><Rect x={spotlight.x} y={spotlight.y} width={spotlight.width} height={spotlight.height} rx='16' fill='black' /></Mask></Defs>
      <Rect x='0' y='0' width={width} height={height} fill='rgba(18, 17, 19, 0.66)' mask='url(#bloom-tour-mask)' />
    </Svg> : <View style={styles.dim} pointerEvents='none' />}
    <Pressable style={StyleSheet.absoluteFill} onPress={() => {}} accessibilityElementsHidden importantForAccessibility='no-hide-descendants' />
    {spotlight && !finalVisible ? <View pointerEvents='none' style={[styles.spotlightBorder, { left: spotlight.x, top: spotlight.y, width: spotlight.width, height: spotlight.height }]} /> : null}
    <View ref={cardRef} onLayout={event => setCardSize(event.nativeEvent.layout)} style={[styles.card, { width: cardWidth, left: cardLeft, top: cardTop }]} accessibilityRole='alert' accessibilityLiveRegion='polite' accessibilityViewIsModal>
      {finalVisible ? <>
        <LotusMark size={32} decorative style={styles.finalMark} />
        <Text style={styles.title}>You’re ready</Text>
        <Text style={styles.description}>Use what helps today. The rest can wait until you need it.</Text>
        {recommendation ? <Pressable style={[styles.primaryButton, styles.finalPrimaryButton]} onPress={runRecommendation} accessibilityRole='button' accessibilityLabel='Start with my recommendation'><Text style={styles.primaryText}>Start with my recommendation</Text></Pressable> : null}
        <Pressable style={styles.secondaryButton} onPress={finish} accessibilityRole='button' accessibilityLabel='Explore Bloom'><Text style={styles.secondaryText}>Explore Bloom</Text></Pressable>
      </> : <>
        <View style={styles.headerRow}>
          <View style={styles.progressDots} accessibilityRole='progressbar' accessibilityValue={{ min: 1, max: steps.length, now: currentTourStep + 1 }}>
            {steps.map((item, index) => <View key={item.id} style={[styles.progressDot, index <= currentTourStep && styles.progressDotActive]} />)}
          </View>
          <Pressable onPress={skip} accessibilityRole='button' accessibilityLabel='Skip tour'><Text style={styles.skip}>Skip</Text></Pressable>
        </View>
        <Text style={styles.title}>{step?.title}</Text>
        <Text style={styles.description}>{step?.description}</Text>
        <View style={styles.actionRow}>
          <Pressable onPress={back} disabled={currentTourStep === 0} accessibilityRole='button' accessibilityLabel='Back' style={[styles.backButton, currentTourStep === 0 && styles.hiddenButton]}><Text style={styles.backText}>Back</Text></Pressable>
          <Pressable onPress={next} accessibilityRole='button' accessibilityLabel={currentTourStep === steps.length - 1 ? 'Finish tour' : 'Next'} style={styles.primaryButton}><Text style={styles.primaryText}>{step?.actionLabel || 'Next'}</Text></Pressable>
        </View>
      </>}
    </View>
  </View>;
}

const styles = createThemedStyles({
  invitationWrap: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', alignItems: 'center', padding: 16, paddingBottom: 24 },
  invitationCard: { width: '100%', maxWidth: CARD_WIDTH, padding: 18, borderRadius: 16, backgroundColor: COLORS.surfaceStrong, shadowColor: COLORS.ink, shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  invitationTitle: { color: COLORS.ink, fontSize: 18, lineHeight: 23, fontWeight: '700', marginBottom: 6 },
  invitationBody: { color: COLORS.body, fontSize: 14, lineHeight: 20 },
  duration: { color: COLORS.brand, fontWeight: '700' },
  invitationActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 14 },
  invitationSecondary: { minHeight: 44, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  dim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(18, 17, 19, 0.66)' },
  spotlightBorder: { position: 'absolute', borderRadius: 16, borderWidth: 1, borderColor: COLORS.brand },
  card: { position: 'absolute', padding: 18, borderRadius: 16, backgroundColor: COLORS.surfaceStrong, shadowColor: COLORS.ink, shadowOpacity: 0.16, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  progressDots: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  progressDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.hairline },
  progressDotActive: { width: 14, backgroundColor: COLORS.brand },
  skip: { color: COLORS.muted, fontSize: 12, fontWeight: '600' },
  title: { color: COLORS.ink, fontSize: 20, lineHeight: 25, fontWeight: '700', marginBottom: 8 },
  description: { color: COLORS.body, fontSize: 14, lineHeight: 20 },
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 16, gap: 8 },
  primaryButton: { minHeight: 44, paddingHorizontal: 16, borderRadius: 12, backgroundColor: COLORS.brand, alignItems: 'center', justifyContent: 'center' },
  finalPrimaryButton: { marginTop: 14 },
  primaryText: { color: COLORS.onBrand, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  backButton: { minHeight: 44, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  backText: { color: COLORS.body, fontSize: 14, fontWeight: '700' },
  hiddenButton: { opacity: 0 },
  finalMark: { marginBottom: 8 },
  secondaryButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  secondaryText: { color: COLORS.brand, fontSize: 14, fontWeight: '700' },
});
