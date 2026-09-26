import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { View } from 'react-native';
import { useProductTour } from './ProductTourContext';

const ProductTourTarget = forwardRef(function ProductTourTarget({ id, ids, children, style, onRegister: providedRegister, ...props }, forwardedRef) {
  const { registerTarget } = useProductTour();
  const onRegister = providedRegister || registerTarget;
  const targetIds = ids || (id ? [id] : []);
  const localRef = useRef(null);
  useImperativeHandle(forwardedRef, () => localRef.current);

  useEffect(() => {
    if (!targetIds.length || !onRegister) return undefined;
    targetIds.forEach(targetId => onRegister(targetId, localRef));
    return () => targetIds.forEach(targetId => onRegister(targetId, null));
  }, [onRegister, targetIds]);

  return (
    <View
      ref={localRef}
      collapsable={false}
      accessible={false}
      style={style}
      {...props}
    >
      {children}
    </View>
  );
});

export default ProductTourTarget;
