import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ONBOARDING_STEPS } from '../data/options';
import { buildOnboardingResult } from '../utils/personalization';

const STORAGE_KEY = '@bloom:v3:onboarding:draft';

const INITIAL_ANSWERS = Object.freeze({
  firstName: '',
  reasonsForJoining: [],
  cyclePattern: null,
  cycleLengthEstimate: null,
  symptoms: [],
  emotionalState: null,
  energyLevel: null,
  priorities: [],
});

export function useOnboardingState({ initialStep = ONBOARDING_STEPS.WELCOME } = {}) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [answers, setAnswers] = useState(INITIAL_ANSWERS);
  const [isReady, setIsReady] = useState(false);
  const [history, setHistory] = useState([initialStep]);

  // Load draft from local storage on mount
  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (!mounted) return;
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed && typeof parsed === 'object') {
              if (parsed.answers) setAnswers(parsed.answers);
              if (typeof parsed.step === 'number') {
                setCurrentStep(parsed.step);
                setHistory([ONBOARDING_STEPS.WELCOME, parsed.step]);
              }
            }
          } catch {
            // Bad JSON; ignore and start fresh
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setIsReady(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Save draft whenever state changes
  useEffect(() => {
    if (!isReady) return;
    const payload = JSON.stringify({ answers, step: currentStep });
    AsyncStorage.setItem(STORAGE_KEY, payload).catch(() => {});
  }, [answers, currentStep, isReady]);

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
    await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    setAnswers(INITIAL_ANSWERS);
    setCurrentStep(ONBOARDING_STEPS.WELCOME);
    setHistory([ONBOARDING_STEPS.WELCOME]);
  }, []);

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
