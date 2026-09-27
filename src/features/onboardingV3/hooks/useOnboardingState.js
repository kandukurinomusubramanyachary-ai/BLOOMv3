import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ONBOARDING_STEPS } from '../data/options';
import { buildOnboardingResult } from '../utils/personalization';
import {
  INITIAL_ONBOARDING_ANSWERS,
  restoreOnboardingDraft,
} from '../utils/onboardingDraft';
import { storage } from '../../../services/storage';

export function useOnboardingState({ uid, initialStep = ONBOARDING_STEPS.WELCOME } = {}) {
  const accountStorage = useMemo(() => storage.forUser(uid), [uid]);
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [answers, setAnswers] = useState(INITIAL_ONBOARDING_ANSWERS);
  const [isReady, setIsReady] = useState(false);
  const [history, setHistory] = useState([initialStep]);
  const [hydratedUid, setHydratedUid] = useState(null);
  const saveQueueRef = useRef(Promise.resolve());

  useEffect(() => {
    let mounted = true;
    let hydrationSucceeded = false;
    setIsReady(false);
    setHydratedUid(null);
    accountStorage.removeLegacyUnscopedOnboardingDraft()
      .then(() => accountStorage.getOnboardingDraft())
      .then((saved) => {
        if (!mounted) return;
        const restored = restoreOnboardingDraft(saved, initialStep);
        setAnswers(restored.answers);
        setCurrentStep(restored.step);
        setHistory(restored.history);
        hydrationSucceeded = true;
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) {
          setHydratedUid(hydrationSucceeded ? uid : null);
          setIsReady(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, [accountStorage, initialStep, uid]);

  useEffect(() => {
    if (!isReady || hydratedUid !== uid) return;
    const payload = { answers, step: currentStep, history };
    saveQueueRef.current = saveQueueRef.current
      .catch(() => {})
      .then(() => accountStorage.setOnboardingDraft(payload))
      .catch(() => {});
  }, [accountStorage, answers, currentStep, history, hydratedUid, isReady, uid]);

  const updateAnswers = useCallback((patch) => {
    setAnswers((prev) => ({
      ...prev,
      ...(typeof patch === 'function' ? patch(prev) : patch),
    }));
  }, []);

  const goToNextStep = useCallback(() => {
    setCurrentStep((prev) => {
      let next;
      if (prev === ONBOARDING_STEPS.PRIORITIES) {
        next = ONBOARDING_STEPS.PROCESSING;
      } else if (prev === ONBOARDING_STEPS.PROCESSING) {
        next = ONBOARDING_STEPS.RESULT;
      } else if (prev < ONBOARDING_STEPS.RESULT) {
        next = prev + 1;
      } else {
        next = prev;
      }
      setHistory((h) => [...h, next]);
      return next;
    });
  }, []);

  const goToPrevStep = useCallback(() => {
    setHistory((prevHistory) => {
      if (prevHistory.length <= 1) {
        setCurrentStep(ONBOARDING_STEPS.WELCOME);
        return [ONBOARDING_STEPS.WELCOME];
      }
      const newHistory = prevHistory.slice(0, -1);
      const prevStep = newHistory[newHistory.length - 1];
      setCurrentStep(prevStep);
      return newHistory;
    });
  }, []);

  const jumpToStep = useCallback((step) => {
    setCurrentStep(step);
    setHistory((h) => [...h, step]);
  }, []);

  const resetOnboarding = useCallback(async () => {
    saveQueueRef.current = saveQueueRef.current
      .catch(() => {})
      .then(() => accountStorage.removeOnboardingDraft());
    await saveQueueRef.current.catch(() => {});
    setAnswers(INITIAL_ONBOARDING_ANSWERS);
    setCurrentStep(ONBOARDING_STEPS.WELCOME);
    setHistory([ONBOARDING_STEPS.WELCOME]);
  }, [accountStorage]);

  const result = buildOnboardingResult(answers);

  return {
    currentStep,
    answers,
    isReady,
    history,
    canGoBack: currentStep > ONBOARDING_STEPS.WELCOME && currentStep !== ONBOARDING_STEPS.PROCESSING,
    updateAnswers,
    goToNextStep,
    goToPrevStep,
    jumpToStep,
    resetOnboarding,
    result,
  };
}
