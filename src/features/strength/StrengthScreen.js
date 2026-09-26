import React, { useEffect } from 'react';
import GuidedStrengthScreen from './GuidedStrengthScreen';
import ProductTourTarget from '../../components/productTour/ProductTourTarget';
import { useProductTour } from '../../components/productTour';

export default function StrengthScreen() {
  const { startIfNeeded } = useProductTour();
  useEffect(() => { startIfNeeded('strengthHome'); }, [startIfNeeded]);
  return (
    <ProductTourTarget ids={['strength', 'strength-recommendation', 'strength-browse', 'strength-progress']}>
      <GuidedStrengthScreen />
    </ProductTourTarget>
  );
}
