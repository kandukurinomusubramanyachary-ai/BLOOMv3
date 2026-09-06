import React, {createContext, useContext, type PropsWithChildren} from 'react';
import {useSquatTracking, type SquatTracking} from './useSquatTracking';

const Context=createContext<SquatTracking|null>(null);
export function StrengthTrackingProvider({children}:PropsWithChildren) {
  const tracking=useSquatTracking();
  return <Context.Provider value={tracking}>{children}</Context.Provider>;
}
export function useStrengthSession() {
  const session=useContext(Context);
  if(!session)throw new Error('Strength screens must be inside StrengthTrackingProvider.');
  return session;
}
