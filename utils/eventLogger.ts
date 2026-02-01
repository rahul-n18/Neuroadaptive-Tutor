import { TutoringConfig, QuizQuestion, NasaTlxResult } from '../types';

export interface LogEvent {
  timestamp: number;
  timestampRelative: number;
  eventType: string;
  metadata?: any;
}

export interface ConversationTurn {
  timestamp: number;
  userQuestion: string; // Transcribed from audio
  aiAnswer: string;
}

export interface QuizDetail {
  questionIndex: number;
  questionText: string;
  selectedOptionText: string;
  isSkipped: boolean;
  isCorrect: boolean;
}

export interface QuizStats {
  totalQuestions: number;
  questionsAnswered: number;
  questionsSkipped: number;
  finalScore: number;
}

export interface SessionLog {
  participantId: string;
  sessionId: string;
  startTime: number;
  
  // Context
  config?: TutoringConfig;
  lessonScript?: string;
  quizQuestions?: QuizQuestion[];
  
  // Interaction
  events: LogEvent[];
  conversationHistory: ConversationTurn[];
  
  // Results
  quizScore?: number;
  quizAnswers?: number[]; // Indices selected (-1 for skip)
  quizStats?: QuizStats;
  quizDetails?: QuizDetail[];
  nasaTlx?: NasaTlxResult;
}

class EventLogger {
  private static instance: EventLogger;
  private currentSession: SessionLog | null = null;

  private constructor() {}

  public static getInstance(): EventLogger {
    if (!EventLogger.instance) {
      EventLogger.instance = new EventLogger();
    }
    return EventLogger.instance;
  }

  public startSession(participantId: string) {
    this.currentSession = {
      participantId,
      sessionId: crypto.randomUUID(),
      startTime: Date.now(),
      events: [],
      conversationHistory: []
    };
  }

  public setSessionContext(config: TutoringConfig, script: string, quiz: QuizQuestion[]) {
    if (!this.currentSession) return;
    this.currentSession.config = config;
    this.currentSession.lessonScript = script;
    this.currentSession.quizQuestions = quiz;
  }

  public logConversation(userQuestion: string, aiAnswer: string) {
    if (!this.currentSession) return;
    this.currentSession.conversationHistory.push({
      timestamp: Date.now(),
      userQuestion,
      aiAnswer
    });
  }

  public setResults(score: number, answers: number[], rating?: NasaTlxResult) {
    if (!this.currentSession) return;
    this.currentSession.quizScore = score;
    this.currentSession.quizAnswers = answers;
    
    // Calculate detailed stats
    if (this.currentSession.quizQuestions) {
        let skippedCount = 0;
        const details: QuizDetail[] = this.currentSession.quizQuestions.map((q, index) => {
            const answerIndex = answers[index];
            const isSkipped = answerIndex === -1;
            if (isSkipped) skippedCount++;

            return {
                questionIndex: index + 1,
                questionText: q.question,
                selectedOptionText: isSkipped ? "SKIPPED" : q.options[answerIndex],
                isSkipped: isSkipped,
                isCorrect: !isSkipped && answerIndex === q.correctIndex
            };
        });

        this.currentSession.quizStats = {
            totalQuestions: this.currentSession.quizQuestions.length,
            questionsAnswered: this.currentSession.quizQuestions.length - skippedCount,
            questionsSkipped: skippedCount,
            finalScore: score
        };
        this.currentSession.quizDetails = details;
    }

    if (rating) {
        this.currentSession.nasaTlx = rating;
    }
  }

  public log(eventType: string, metadata: any = {}) {
    if (!this.currentSession) return;
    const now = Date.now();
    this.currentSession.events.push({
      timestamp: now,
      timestampRelative: now - this.currentSession.startTime,
      eventType,
      metadata
    });
  }

  public exportJSON() {
    if (!this.currentSession) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.currentSession, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    
    // Create a filename with topic and timestamp
    const topic = this.currentSession.config?.topic.replace(/\s+/g, '_') || 'session';
    const filename = `NeuroTutor_${topic}_${this.currentSession.startTime}.json`;
    
    downloadAnchorNode.setAttribute("download", filename);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }
}

export const logger = EventLogger.getInstance();