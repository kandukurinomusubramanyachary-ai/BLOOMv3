import React, { useCallback } from 'react';
import { View, StyleSheet, SafeAreaView, Platform, Text } from 'react-native';
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
  const {
    currentStep,
    answers,
    isReady,
    canGoBack,
    updateAnswers,
    goToNextStep,
    goToPrevStep,
    jumpToStep,
    resetOnboarding,
    result,
  } = useOnboardingState({ initialStep });

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

  const handlePrimaryAction = useCallback(
    (action) => {
      if (onComplete) {
        onComplete(result, action);
      } else if (navigation?.navigate) {
        if (action.route === 'DailyCheckIn') {
          navigation.navigate('DailyCheckIn');
        } else if (action.route === 'Meg' || action.route === 'Strength' || action.route === 'Diet') {
          navigation.navigate('Main', { screen: action.route });
        } else {
          navigation.navigate('Main');
        }
      }
    },
    [navigation, onComplete, result]
  );

  const handleFinish = useCallback(() => {
    if (onComplete) {
      onComplete(result, null);
    } else if (navigation?.navigate) {
      navigation.navigate('Main');
    }
  }, [navigation, onComplete, result]);

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
            onSkip={handleSkip}
            showSkip
            onReset={resetOnboarding}
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
              fullResult={result}
              onPrimaryAction={handlePrimaryAction}
              onFinish={handleFinish}
              onReset={resetOnboarding}
            />
          )}
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
});
