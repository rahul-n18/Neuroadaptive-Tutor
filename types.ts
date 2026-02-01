export enum AppState {
  WELCOME,
  CALIBRATION_INTRO,
  CALIBRATION_RUNNING,
  CALIBRATION_COMPLETE,
  TUTORING_SETUP,
  TUTORING_SESSION,
  FINISHED
}

export enum WorkloadCondition {
  LOW = 'LOW', // Rest
  HIGH = 'HIGH' // Mental Arithmetic
}

export enum TutoringComplexity {
  SIMPLE = 'Simple',
  COMPLEX = 'Complex'
}

export enum TutoringPacing {
  NORMAL = 'Normal',
  FAST = 'Fast'
}

export interface TutoringConfig {
  topic: string;
  complexity: TutoringComplexity;
  pacing: TutoringPacing;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

export interface TutoringSessionData {
  script: string;
  audioBase64: string;
  quiz: QuizQuestion[];
}

export interface NasaTlxResult {
  mentalDemand: number;
  performance: number;
  effort: number;
  frustration: number;
}
