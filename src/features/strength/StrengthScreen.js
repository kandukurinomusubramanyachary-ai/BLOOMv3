import React, { useEffect } from 'react';
import GuidedStrengthScreen from './GuidedStrengthScreen';
import ProductTourTarget from '../../components/productTour/ProductTourTarget';
import { useProductTour } from '../../components/productTour';
import { GUIDE_METADATA } from '../../components/productTour/tourSteps';

export default function StrengthScreen() {
  const { pendingReplay, startIfNeeded } = useProductTour();
  useEffect(() => { startIfNeeded('strengthHome'); }, [startIfNeeded]);
  const promptWorkoutGuide = () => startIfNeeded('strengthWorkout');
  const promptSummaryGuide = () => startIfNeeded('strengthSummary');
  return (
    <ProductTourTarget id='strength'>
      <GuidedStrengthScreen TourTarget={ProductTourTarget} onWorkoutStart={promptWorkoutGuide} onSummaryShown={promptSummaryGuide} guideHint={GUIDE_METADATA[pendingReplay?.tourId]?.contextHint} />
    </ProductTourTarget>
  );
}
