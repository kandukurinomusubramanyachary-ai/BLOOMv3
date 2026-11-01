import React, { useCallback, useEffect, useState } from 'react';
import { View, SafeAreaView, Text } from 'react-native';
import { useOnboardingState } from './hooks/useOnboardingState';
import { ONBOARDING_STEPS, TOTAL_INTERACTIVE_STEPS } from './data/options';
import ProgressBar from './components/ProgressBar';
import WelcomeStep from './screens/WelcomeStep';
import NameStep from './screens/NameStep';
import ReasonsStep from './screens/ReasonsStep';
import CycleStep from './screens/CycleStep';
import SymptomsStep from './screens/SymptomsStep';
import EmotionsStep from './screens/EmotionsStep';
import EnergyStep from './screens/EnergyStep';
import PrioritiesStep from './screens/PrioritiesStep';
import ProcessingStep from './screens/ProcessingStep';
import ResultStep from './screens/ResultStep';
import { COLORS, createThemedStyles } from '../../utils/constants';
import { useProductTour } from '../../components/productTour';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { storage } from '../../services/storage';

/**
 * Self-contained Bloom V3 Onboarding Module Container.
 *
 * Can be run standalone or rendered inside a navigation screen.
 * Handles state, transitions, step progression, and handoff contracts.
 */
export default function OnboardingV3Screen({
  navigation,
  initialStep = ONBOARDING_STEPS.WELCOME,
  onComplete,
}) {
  const { user } = useAuth();
  const { saveProfile } = useApp();
  const [saving, setSaving] = useState(false);
  const [finishError, setFinishError] = useState('');
  const { requestOverviewInvitation, setRecommendationHandler } = useProductTour();
  const navigateToRecommendation = useCallback((action) => {
    if (!navigation?.navigate) return;
    if (action?.route === 'DailyCheckIn') navigation.navigate('DailyCheckIn');
    else if (action?.route === 'Meg' || action?.route === 'Strength' || action?.route === 'Diet') navigation.navigate('Main', { screen: action.route });
    else navigation.navigate('Main');
  }, [navigation]);
  useEffect(() => { setRecommendationHandler(navigateToRecommendation); }, [navigateToRecommendation, setRecommendationHandler]);
  const {
    currentStep,
    answers,
    isReady,
    canGoBack,
    updateAnswers,
    goToNextStep,
    goToPrevStep,
    result,
  } = useOnboardingState({ uid: user?.uid, initialStep });

  const handleNextWithAnswers = useCallback(
    (patch) => {
      updateAnswers(patch);
      goToNextStep();
    },
    [updateAnswers, goToNextStep]
  );

  const handleSkip = useCallback(() => {
    goToNextStep();
  }, [goToNextStep]);

  const completeOnboarding = useCallback(async (action) => {
    if (saving) return;
    if (!user?.uid) {
      setFinishError('Please sign in again to finish setting up Bloom.');
      return;
    }
    setSaving(true);
    setFinishError('');
    try {
      // This must persist before navigation so the onboarding screen is not
      // shown again on the next login. Do not change the required consent.
      const record = result.onboardingRecord || {};
      await saveProfile({
        onboardingCompleted: true,
        ...(record.hasExplicitName && record.firstName ? { firstName: record.firstName } : {}),
      });
      // The draft contains sensitive self-reported answers and is no longer needed.
      await storage.forUser(user.uid).removeOnboardingDraft();
      if (onComplete) {
        await onComplete(result, action);
      } else if (navigation?.reset) {
        requestOverviewInvitation(null);
        if (action?.route === 'DailyCheckIn') {
          navigation.reset({ index: 1, routes: [{ name: 'Main' }, { name: 'DailyCheckIn' }] });
        } else {
          const screen = ['Meg', 'Strength', 'Diet'].includes(action?.route) ? action.route : null;
          navigation.reset({
            index: 0,
            routes: [{ name: 'Main', ...(screen ? { params: { screen } } : {}) }],
          });
        }
      }
    } catch {
      setFinishError('Bloom could not finish your setup. Check your connection, then try again.');
    } finally {
      setSaving(false);
    }
  }, [navigation, onComplete, requestOverviewInvitation, result, saveProfile, saving, user?.uid]);

  const handlePrimaryAction = useCallback(
    (action) => { void completeOnboarding(action); },
    [completeOnboarding]
  );

  const handleFinish = useCallback(
    () => { void completeOnboarding(null); },
    [completeOnboarding]
  );

  if (!isReady) {
    return <View style={styles.container} />;
  }

  // Interactive step number: 1 (Name) to 7 (Priorities)
  const isInteractiveQuestion =
    currentStep >= ONBOARDING_STEPS.NAME && currentStep <= ONBOARDING_STEPS.PRIORITIES;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Progress Header only for interactive questions */}
        {isInteractiveQuestion ? (
          <ProgressBar
            currentStep={currentStep}
            totalSteps={TOTAL_INTERACTIVE_STEPS}
            onBack={canGoBack ? goToPrevStep : null}
          />
        ) : null}

        <View style={styles.stepContainer}>
          {currentStep === ONBOARDING_STEPS.WELCOME && (
            <WelcomeStep onNext={goToNextStep} />
          )}

          {currentStep === ONBOARDING_STEPS.NAME && (
            <NameStep
              initialName={answers.firstName}
              onNext={handleNextWithAnswers}
              onSkip={handleSkip}
            />
          )}

          {currentStep === ONBOARDING_STEPS.REASONS && (
            <ReasonsStep
              initialSelections={answers.reasonsForJoining}
              onNext={handleNextWithAnswers}
              onSkip={handleSkip}
            />
          )}

          {currentStep === ONBOARDING_STEPS.CYCLE && (
            <CycleStep
              initialPattern={answers.cyclePattern}
              initialLength={answers.cycleLengthEstimate}
              onNext={handleNextWithAnswers}
              onSkip={handleSkip}
            />
          )}

          {currentStep === ONBOARDING_STEPS.SYMPTOMS && (
            <SymptomsStep
              initialSymptoms={answers.symptoms}
              onNext={handleNextWithAnswers}
              onSkip={handleSkip}
            />
          )}

          {currentStep === ONBOARDING_STEPS.EMOTIONS && (
            <EmotionsStep
              initialEmotion={answers.emotionalState}
              onNext={handleNextWithAnswers}
              onSkip={handleSkip}
            />
          )}

          {currentStep === ONBOARDING_STEPS.ENERGY && (
            <EnergyStep
              initialEnergy={answers.energyLevel}
              onNext={handleNextWithAnswers}
              onSkip={handleSkip}
            />
          )}

          {currentStep === ONBOARDING_STEPS.PRIORITIES && (
            <PrioritiesStep
              initialPriorities={answers.priorities}
              onNext={handleNextWithAnswers}
              onSkip={handleSkip}
            />
          )}

          {currentStep === ONBOARDING_STEPS.PROCESSING && (
            <ProcessingStep onComplete={goToNextStep} />
          )}

          {currentStep === ONBOARDING_STEPS.RESULT && (
            <ResultStep
              summary={result.summary}
              onPrimaryAction={handlePrimaryAction}
              onFinish={handleFinish}
            />
          )}
          {saving ? <Text style={styles.status} accessibilityRole='status'>Saving your setup...</Text> : null}
          {finishError ? <Text style={styles.error} accessibilityRole='alert'>{finishError}</Text> : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = createThemedStyles({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.canvas,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.canvas,
  },
  stepContainer: {
    flex: 1,
  },
  status: { padding: 12, textAlign: 'center', color: COLORS.ink },
  error: { padding: 12, textAlign: 'center', color: COLORS.ink },
});
