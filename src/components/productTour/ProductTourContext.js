import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import { PRODUCT_TOUR_STORAGE_KEY, TOUR_SETS, TOUR_SET_LABELS } from './tourSteps';
import { createTourRecord, isTourHandled, productTourStorageKey } from './tourState';

const ProductTourContext = createContext(null);
const DEFAULT_PROGRESS = {};

const storageKey = uid => productTourStorageKey(PRODUCT_TOUR_STORAGE_KEY, uid);
const isHandled = isTourHandled;

export function ProductTourProvider({ children }) {
  const { user } = useAuth();
  const [tourProgress, setTourProgress] = useState(DEFAULT_PROGRESS);
  const [overviewInvitation, setOverviewInvitation] = useState(null);
  const [invitation, setInvitation] = useState(null);
  const [activeTourId, setActiveTourId] = useState(null);
  const [currentTourStep, setCurrentTourStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [finalVisible, setFinalVisible] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [tourStateReady, setTourStateReady] = useState(false);
  const [recommendation, setRecommendation] = useState(null);
  const [pendingReplay, setPendingReplay] = useState(null);
  const recommendationHandler = useRef(null);
  const pendingOverviewRef = useRef(null);
  const pendingReplayRef = useRef(null);
  const pendingReplayStarterRef = useRef(null);
  const featureEntryRef = useRef(null);
  const featureVisitCounter = useRef(0);
  const targetsRef = useRef(new Map());

  useEffect(() => {
    let active = true;
    const uid = user?.uid;
    setTourStateReady(false);
    setVisible(false);
    setFinalVisible(false);
    setInvitation(null);
    setActiveTourId(null);
    setRecommendation(null);
    setPendingReplay(null);
    pendingReplayRef.current = null;
    targetsRef.current.clear();
    setTourProgress(DEFAULT_PROGRESS);
    setOverviewInvitation(null);
    if (!uid) return undefined;
    AsyncStorage.getItem(storageKey(uid)).then(value => {
      if (!active) return;
      try {
        const parsed = value ? JSON.parse(value) : {};
        setTourProgress(parsed.tours || {});
        setOverviewInvitation(parsed.overviewInvitation || null);
      } catch {
        setTourProgress(DEFAULT_PROGRESS);
      }
      setTourStateReady(true);
    }).catch(() => setTourStateReady(true));
    return () => { active = false; };
  }, [user?.uid]);

  useEffect(() => {
    let active = true;
    Promise.resolve(AccessibilityInfo.isReduceMotionEnabled?.()).then(value => { if (active) setReduceMotion(Boolean(value)); }).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener?.('reduceMotionChanged', value => setReduceMotion(Boolean(value)));
    return () => { active = false; subscription?.remove?.(); };
  }, []);

  const persist = useCallback((nextProgress, nextInvitation = overviewInvitation) => {
    setTourProgress(nextProgress);
    setOverviewInvitation(nextInvitation);
    if (user?.uid) AsyncStorage.setItem(storageKey(user.uid), JSON.stringify({ tours: nextProgress, overviewInvitation: nextInvitation })).catch(() => undefined);
  }, [overviewInvitation, user?.uid]);

  const registerTarget = useCallback((id, ref) => {
    if (ref) targetsRef.current.set(id, ref);
    else targetsRef.current.delete(id);
    if (ref && pendingReplayRef.current) {
      requestAnimationFrame(() => pendingReplayStarterRef.current?.(0));
    }
  }, []);

  const steps = activeTourId ? (TOUR_SETS[activeTourId] || []) : [];
  const currentStep = steps[currentTourStep];

  const startTour = useCallback((tourId = 'appOverview', stepIndex = 0, nextAction = null) => {
    const tourSteps = TOUR_SETS[tourId];
    if (!tourSteps?.length) return;
    const safeStep = Math.max(0, Math.min(Number(stepIndex) || 0, tourSteps.length - 1));
    setInvitation(null);
    setRecommendation(nextAction || null);
    setActiveTourId(tourId);
    setCurrentTourStep(safeStep);
    setFinalVisible(false);
    setVisible(true);
  }, []);

  const isTargetReady = useCallback((tourId) => {
    const firstStep = TOUR_SETS[tourId]?.[0];
    const node = firstStep ? targetsRef.current.get(firstStep.id)?.current : null;
    if (!node) return false;
    if (typeof node.getBoundingClientRect !== 'function') return true;
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }, []);

  const startPendingReplay = useCallback((attempt = 0) => {
    const pending = pendingReplayRef.current;
    if (!pending) return;
    if (isTargetReady(pending.tourId)) {
      pendingReplayRef.current = null;
      setPendingReplay(null);
      startTour(pending.tourId, pending.stepIndex, pending.recommendation);
      return;
    }
    if (attempt < 60) requestAnimationFrame(() => startPendingReplay(attempt + 1));
  }, [isTargetReady, startTour]);
  pendingReplayStarterRef.current = startPendingReplay;

  const requestTourReplay = useCallback((tourId, stepIndex = 0, recommendation = null) => {
    if (!TOUR_SETS[tourId]?.length) return false;
    const pending = { tourId, stepIndex, recommendation };
    pendingReplayRef.current = pending;
    setPendingReplay(pending);
    requestAnimationFrame(() => startPendingReplay(0));
    return true;
  }, [startPendingReplay]);

  const showTourInvitation = useCallback((tourId, visitId = null) => {
    if (!tourStateReady || !tourId || !TOUR_SETS[tourId] || isHandled(tourProgress[tourId]) || visible || invitation) return false;
    setInvitation({ tourId, visitId });
    return true;
  }, [invitation, tourProgress, tourStateReady, visible]);

  const enterFeature = useCallback((feature) => {
    const normalized = String(feature || '').trim();
    if (!normalized) return null;
    const visit = { feature: normalized, visitId: ++featureVisitCounter.current, invitationOffered: false };
    featureEntryRef.current = visit;
    return visit.visitId;
  }, []);

  const acceptInvitation = useCallback(() => {
    if (invitation?.tourId) startTour(invitation.tourId, 0, invitation.recommendation);
  }, [invitation, startTour]);

  const declineInvitation = useCallback(() => {
    if (!invitation?.tourId) return;
    const tourId = invitation.tourId;
    const record = createTourRecord('skipped');
    const next = { ...tourProgress, [tourId]: record };
    if (tourId === 'appOverview') persist(next, { status: 'handled', handledAt: new Date().toISOString() });
    else persist(next);
    setInvitation(null);
  }, [invitation, persist, tourProgress]);

  const dismissInvitation = useCallback(() => setInvitation(null), []);

  const requestOverviewInvitation = useCallback((recommendation = null) => {
    if (!tourStateReady) {
      pendingOverviewRef.current = { recommendation };
      return true;
    }
    if (isHandled(tourProgress.appOverview) || overviewInvitation?.status === 'handled') return false;
    setInvitation({ tourId: 'appOverview', overview: true, recommendation });
    return true;
  }, [overviewInvitation, tourProgress.appOverview, tourStateReady]);

  useEffect(() => {
    if (!tourStateReady || pendingOverviewRef.current === null) return;
    const pending = pendingOverviewRef.current;
    pendingOverviewRef.current = null;
    requestAnimationFrame(() => requestOverviewInvitation(pending.recommendation));
  }, [requestOverviewInvitation, tourStateReady]);

  const startIfNeeded = useCallback((tourId) => {
    const visit = featureEntryRef.current;
    if (!tourStateReady || !tourId || tourId === 'appOverview' || isHandled(tourProgress[tourId]) || !isHandled(tourProgress.appOverview)) return false;
    if (!visit || visit.feature !== tourId || visit.invitationOffered) return false;
    visit.invitationOffered = true;
    return showTourInvitation(tourId, visit.visitId);
  }, [showTourInvitation, tourProgress, tourStateReady]);

  const next = useCallback(() => {
    if (!activeTourId || !steps.length) return;
    if (currentTourStep >= steps.length - 1) {
      const next = { ...tourProgress, [activeTourId]: createTourRecord('completed') };
      persist(next);
      setFinalVisible(true);
      return;
    }
    setCurrentTourStep(value => value + 1);
  }, [activeTourId, currentTourStep, persist, steps.length, tourProgress]);

  const back = useCallback(() => setCurrentTourStep(value => Math.max(0, value - 1)), []);

  const skip = useCallback(() => {
    if (activeTourId) persist({ ...tourProgress, [activeTourId]: createTourRecord('skipped') });
    setFinalVisible(false);
    setVisible(false);
    setInvitation(null);
    setActiveTourId(null);
  }, [activeTourId, persist, tourProgress]);

  const finish = useCallback(() => {
    setFinalVisible(false);
    setVisible(false);
    setInvitation(null);
    setActiveTourId(null);
    setRecommendation(null);
  }, []);

  const runRecommendation = useCallback(() => {
    const action = recommendation;
    const handler = recommendationHandler.current;
    finish();
    if (action && handler) handler(action);
  }, [finish, recommendation]);

  const setRecommendationHandler = useCallback((handler) => {
    recommendationHandler.current = handler;
    return () => { if (recommendationHandler.current === handler) recommendationHandler.current = null; };
  }, []);

  const resetTour = useCallback((tourId) => {
    const next = { ...tourProgress };
    if (tourId) delete next[tourId];
    else Object.keys(next).forEach(key => delete next[key]);
    persist(next, tourId ? overviewInvitation : null);
    finish();
  }, [finish, overviewInvitation, persist, tourProgress]);

  const value = useMemo(() => ({
    tourStateReady,
    visible,
    invitation,
    finalVisible,
    recommendation,
    pendingReplay,
    activeTourId,
    currentTourStep,
    currentStep,
    steps,
    tourProgress,
    tourSets: TOUR_SETS,
    tourLabels: TOUR_SET_LABELS,
    reduceMotion,
    targetsRef,
    registerTarget,
    startTour,
    startIfNeeded,
    enterFeature,
    showTourInvitation,
    requestOverviewInvitation,
    acceptInvitation,
    declineInvitation,
    dismissInvitation,
    runRecommendation,
    setRecommendationHandler,
    requestTourReplay,
    next,
    back,
    skip,
    finish,
    resetTour,
    closeTour: skip,
  }), [acceptInvitation, activeTourId, back, currentStep, currentTourStep, declineInvitation, dismissInvitation, enterFeature, finalVisible, finish, invitation, next, pendingReplay, recommendation, reduceMotion, registerTarget, requestOverviewInvitation, requestTourReplay, resetTour, runRecommendation, setRecommendationHandler, showTourInvitation, skip, startIfNeeded, startTour, steps, tourProgress, tourStateReady, visible]);

  return <ProductTourContext.Provider value={value}>{children}</ProductTourContext.Provider>;
}

export function useProductTour() {
  const value = useContext(ProductTourContext);
  if (!value) throw new Error('useProductTour must be used inside ProductTourProvider');
  return value;
}
