export interface LogEvent {
  timestamp: number;
  timestampRelative: number;
  eventType: string;
  metadata?: any;
}

export interface SessionLog {
  participantId: string;
  sessionId: string;
  startTime: number;
  events: LogEvent[];
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
      events: []
    };
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
    const filename = `session_${this.currentSession.participantId}_${this.currentSession.startTime}.json`;
    downloadAnchorNode.setAttribute("download", filename);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }
}

export const logger = EventLogger.getInstance();