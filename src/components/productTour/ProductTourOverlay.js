import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, findNodeHandle, Platform, Pressable, StyleSheet, Text, UIManager, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../utils/constants';
import { useProductTour } from './ProductTourContext';
import { GUIDE_METADATA } from './tourSteps';

const CARD_WIDTH = 320;
const GAP = 14;
const EDGE = 16;

export default function ProductTourOverlay() {
  const { visible, invitation, finalVisible, currentTourStep, steps, targetsRef, next, back, skip, finish, acceptInvitation, declineInvitation, runRecommendation, reduceMotion } = useProductTour();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [spotlight, setSpotlight] = useState(null);
  const [placement, setPlacement] = useState('below');
  const [cardSize, setCardSize] = useState({ width: 0, height: 0 });
  const cardRef = useRef(null);
  const step = steps[currentTourStep];

  const measureTarget = useCallback(() => {
    if (!step || finalVisible) return;
    const targetRef = targetsRef.current.get(step.id);
    const node = targetRef?.current;
    if (!node) {
      setSpotlight(null);
      return;
    }
    const apply = (x, y, targetWidth, targetHeight) => {
      if (!targetWidth || !targetHeight) return;
      const padding = 7;
      const nextSpotlight = {
        x: Math.max(4, x - padding),
        y: Math.max(4, y - padding),
        width: Math.min(width - 8, targetWidth + padding * 2),
        height: Math.min(height - 8, targetHeight + padding * 2),
      };
      setSpotlight(nextSpotlight);
      const measuredCardHeight = cardSize.height || 174;
      const roomBelow = height - (nextSpotlight.y + nextSpotlight.height) - Math.max(insets.bottom, EDGE) - GAP;
      setPlacement(roomBelow >= measuredCardHeight || nextSpotlight.y < measuredCardHeight ? 'below' : 'above');
    };
    try {
      if (Platform.OS === 'web' && typeof node.getBoundingClientRect === 'function') {
        const rect = node.getBoundingClientRect();
        if (rect.top < 0 || rect.bottom > height) {
          node.scrollIntoView?.({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center', inline: 'nearest' });
          setTimeout(measureTarget, reduceMotion ? 0 : 220);
          return;
        }
        apply(rect.x, rect.y, rect.width, rect.height);
      } else if (typeof node.measureInWindow === 'function') {
        node.measureInWindow((x, y, targetWidth, targetHeight) => apply(x, y, targetWidth, targetHeight));
      }
    } catch {
      setSpotlight(null);
    }
  }, [cardSize.height, finalVisible, height, insets.bottom, reduceMotion, step, targetsRef, width]);

  useEffect(() => {
    if (!visible || finalVisible) return undefined;
    setSpotlight(null);
    const timer = setTimeout(measureTarget, reduceMotion ? 0 : 180);
    const onResize = () => measureTarget();
    if (Platform.OS === 'web') window.addEventListener('resize', onResize);
    return () => {
      clearTimeout(timer);
      if (Platform.OS === 'web') window.removeEventListener('resize', onResize);
    };
  }, [currentTourStep, finalVisible, measureTarget, reduceMotion, visible]);

  useEffect(() => {
    if (!visible || finalVisible || spotlight || !step) return undefined;
    const timer = setTimeout(() => {
      // A missing target should never strand or crash the tour.
      if (currentTourStep < steps.length - 1) next();
      else skip();
    }, 900);
    return () => clearTimeout(timer);
  }, [currentTourStep, finalVisible, next, skip, spotlight, step, steps.length, visible]);

  useEffect(() => {
    if (!visible || !step || finalVisible) return undefined;
    const title = `${step.title}. Step ${currentTourStep + 1} of ${steps.length}.`;
    AccessibilityInfo.announceForAccessibility?.(title);
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
    return (
      <View style={styles.invitationWrap} pointerEvents='box-none'>
        <View style={styles.invitationCard} accessibilityRole='alert'>
          <Text style={styles.invitationTitle}>{meta.title}</Text>
          <Text style={styles.invitationBody}>{meta.body} <Text style={styles.duration}>{meta.duration}</Text></Text>
          <View style={styles.invitationActions}>
            <Pressable onPress={declineInvitation} accessibilityRole='button' accessibilityLabel={isOverview ? 'No thanks' : 'Skip guide'} style={styles.invitationSecondary}><Text style={styles.secondaryText}>{isOverview ? 'No thanks' : 'Skip'}</Text></Pressable>
            <Pressable onPress={acceptInvitation} accessibilityRole='button' accessibilityLabel={isOverview ? 'Show me around' : 'Show me'} style={styles.primaryButton}><Text style={styles.primaryText}>{isOverview ? 'Show me around' : 'Show me'}</Text></Pressable>
          </View>
        </View>
      </View>
    );
  }

  const cardWidth = Math.min(CARD_WIDTH, width - EDGE * 2);
  const cardLeft = Math.max(EDGE, Math.min(width - cardWidth - EDGE, ((spotlight?.x || width / 2) + (spotlight?.width || 0) / 2) - cardWidth / 2));
  const cardHeight = finalVisible ? 232 : cardSize.height || 174;
  let cardTop = (height - cardHeight) / 2;
  if (!finalVisible && spotlight) {
    cardTop = placement === 'below'
      ? spotlight.y + spotlight.height + GAP
      : spotlight.y - cardHeight - GAP;
    cardTop = Math.max(Math.max(insets.top, EDGE), Math.min(height - cardHeight - Math.max(insets.bottom, EDGE), cardTop));
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents='box-none' accessibilityViewIsModal accessibilityLabel='Bloom product tour'>
      {spotlight && !finalVisible ? (
        <Svg style={StyleSheet.absoluteFill} pointerEvents='none' width={width} height={height}>
          <Defs>
            <Mask id='bloom-tour-mask'>
              <Rect x='0' y='0' width={width} height={height} fill='white' />
              <Rect x={spotlight.x} y={spotlight.y} width={spotlight.width} height={spotlight.height} rx='16' fill='black' />
            </Mask>
          </Defs>
          <Rect x='0' y='0' width={width} height={height} fill='rgba(12, 25, 29, 0.76)' mask='url(#bloom-tour-mask)' />
        </Svg>
      ) : (
        <View style={styles.dim} pointerEvents='none' />
      )}

      <Pressable style={StyleSheet.absoluteFill} onPress={() => {}} accessibilityElementsHidden importantForAccessibility='no-hide-descendants' />

      {spotlight && !finalVisible ? <View pointerEvents='none' style={[styles.spotlightBorder, { left: spotlight.x, top: spotlight.y, width: spotlight.width, height: spotlight.height }]} /> : null}

      <View ref={cardRef} onLayout={event => setCardSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })} style={[styles.card, { width: cardWidth, left: cardLeft, top: cardTop }]} accessibilityRole='alert' accessibilityViewIsModal>
        {finalVisible ? (
          <>
            <Text style={styles.finalEmoji}>🌷</Text>
            <Text style={styles.title}>You’re ready</Text>
            <Text style={styles.description}>You don’t need to use everything at once. Bloom will help you focus on what matters most today.</Text>
            <Pressable style={styles.primaryButton} onPress={runRecommendation} accessibilityRole='button' accessibilityLabel='Start with my recommendation'>
              <Text style={styles.primaryText}>Start with my recommendation</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={finish} accessibilityRole='button' accessibilityLabel='Explore Bloom'>
              <Text style={styles.secondaryText}>Explore Bloom</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.headerRow}>
              <Text style={styles.counter}>{currentTourStep + 1} / {steps.length}</Text>
              <Pressable onPress={skip} accessibilityRole='button' accessibilityLabel='Skip tour'>
                <Text style={styles.skip}>Skip tour</Text>
              </Pressable>
            </View>
            <Text style={styles.title}>{step?.title}</Text>
            <Text style={styles.description}>{step?.description}</Text>
            <View style={styles.actionRow}>
              <Pressable onPress={back} disabled={currentTourStep === 0} accessibilityRole='button' accessibilityLabel='Back' style={[styles.backButton, currentTourStep === 0 && styles.hiddenButton]}>
                <Text style={styles.backText}>Back</Text>
              </Pressable>
              <Pressable onPress={next} accessibilityRole='button' accessibilityLabel={currentTourStep === steps.length - 1 ? 'Finish tour' : 'Next'} style={styles.primaryButton}>
                <Text style={styles.primaryText}>{step?.actionLabel || 'Next'}</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  invitationWrap: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', alignItems: 'center', padding: 16, paddingBottom: 24 },
  invitationCard: { width: '100%', maxWidth: CARD_WIDTH, padding: 18, borderRadius: 20, backgroundColor: '#FFFDF9', shadowColor: '#07181A', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  invitationTitle: { color: COLORS.ink, fontSize: 18, lineHeight: 23, fontWeight: '700', marginBottom: 6 },
  invitationBody: { color: COLORS.body, fontSize: 14, lineHeight: 20 },
  duration: { color: COLORS.brand, fontWeight: '700' },
  invitationActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 14 },
  invitationSecondary: { minHeight: 42, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  dim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(12, 25, 29, 0.76)' },
  spotlightBorder: { position: 'absolute', borderRadius: 16, borderWidth: 2, borderColor: COLORS.brand, shadowColor: COLORS.brand, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  card: { position: 'absolute', padding: 18, borderRadius: 20, backgroundColor: '#FFFDF9', shadowColor: '#07181A', shadowOpacity: 0.24, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  counter: { color: COLORS.brand, fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },
  skip: { color: COLORS.muted, fontSize: 12, fontWeight: '600' },
  title: { color: COLORS.ink, fontSize: 20, lineHeight: 25, fontWeight: '700', marginBottom: 8 },
  description: { color: COLORS.body, fontSize: 14, lineHeight: 20 },
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 16, gap: 8 },
  primaryButton: { minHeight: 42, paddingHorizontal: 16, borderRadius: 13, backgroundColor: COLORS.brand, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  backButton: { minHeight: 42, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  backText: { color: COLORS.body, fontSize: 14, fontWeight: '700' },
  hiddenButton: { opacity: 0 },
  finalEmoji: { fontSize: 25, marginBottom: 5 },
  secondaryButton: { minHeight: 38, alignItems: 'center', justifyContent: 'center', marginTop: 3 },
  secondaryText: { color: COLORS.brand, fontSize: 14, fontWeight: '700' },
});
