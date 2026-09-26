import React, { useEffect } from 'react';
import StrengthExperience from './StrengthExperience';
import TrackedStrengthScreen from './TrackedStrengthScreen.web';
import ProductTourTarget from '../../components/productTour/ProductTourTarget';
import { useProductTour } from '../../components/productTour';

export default function StrengthScreen() {
  const { startIfNeeded } = useProductTour();
  useEffect(() => { startIfNeeded('strengthHome'); }, [startIfNeeded]);
  const promptWorkoutGuide = () => startIfNeeded('strengthWorkout');
  const promptSummaryGuide = () => startIfNeeded('strengthSummary');
  return (
    <ProductTourTarget id='strength'>
      <StrengthExperience TrackedPlayer={TrackedStrengthScreen} TourTarget={ProductTourTarget} onWorkoutStart={promptWorkoutGuide} onSummaryShown={promptSummaryGuide} />
    </ProductTourTarget>
  );
}
