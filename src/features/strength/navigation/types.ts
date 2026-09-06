export type StrengthStackParamList = {
  StrengthHome: undefined;
  CameraSetup: undefined;
  LiveWorkout: {mode:'tracked'|'manual'};
  WorkoutComplete: {reps:number;mode:'tracked'|'manual';reachedTarget:boolean};
  StrengthDeveloper: undefined;
};
