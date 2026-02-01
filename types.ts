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
  SIMPLE = 'A',
  COMPLEX = 'B'
}

export enum TutoringPacing {
  NORMAL = 'C',
  FAST = 'D'
}

export type SessionMode = 'explanation' | 'interruption' | 'quiz' | 'default';

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