export const decodeAudioData = async (
  base64String: string,
  audioContext: AudioContext
): Promise<AudioBuffer> => {
  const binaryString = atob(base64String);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Gemini TTS model (gemini-2.5-flash-preview-tts) returns raw PCM data.
  // Format: 24kHz, 16-bit, Mono.
  // It does NOT have a WAV header, so audioContext.decodeAudioData will fail.
  // We must manually decode the PCM data.
  
  const sampleRate = 24000;
  const numChannels = 1;
  
  // Create Int16Array view of the data
  // Ensure the byte length is even for Int16Array
  if (bytes.length % 2 !== 0) {
      console.warn("Audio byte length is odd, trimming last byte for PCM decoding");
  }
  const dataInt16 = new Int16Array(bytes.buffer, 0, Math.floor(bytes.length / 2));
  
  const buffer = audioContext.createBuffer(numChannels, dataInt16.length, sampleRate);
  const channelData = buffer.getChannelData(0);
  
  for (let i = 0; i < dataInt16.length; i++) {
    // Convert 16-bit PCM to float range [-1.0, 1.0]
    channelData[i] = dataInt16[i] / 32768.0;
  }
  
  return buffer;
};

export class AudioPlayer {
  private audioContext: AudioContext;
  private source: AudioBufferSourceNode | null = null;
  private isPlaying: boolean = false;
  private pausedAt: number = 0;
  private startTime: number = 0;
  private buffer: AudioBuffer | null = null;
  private playbackRate: number = 1.0;
  private onEndedCallback: (() => void) | null = null;
  public analyser: AnalyserNode;

  constructor(rate: number = 1.0) {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.playbackRate = rate;
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256; // Good balance for visualizer
    this.analyser.smoothingTimeConstant = 0.8;
  }

  async loadAudio(base64String: string) {
    this.buffer = await decodeAudioData(base64String, this.audioContext);
  }

  async play(onEnded?: () => void) {
    if (!this.buffer) return;
    
    // Ensure context is running (browser policy)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    this.onEndedCallback = onEnded || null;

    this.source = this.audioContext.createBufferSource();
    this.source.buffer = this.buffer;
    this.source.playbackRate.value = this.playbackRate;
    
    // Connect: Source -> Analyser -> Destination
    this.source.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);
    
    this.source.start(0, this.pausedAt);
    this.startTime = this.audioContext.currentTime;
    this.isPlaying = true;

    this.source.onended = () => {
      // Only trigger if naturally ended, not manually stopped/paused
      if (this.isPlaying) {
        this.isPlaying = false;
        this.pausedAt = 0;
        if (this.onEndedCallback) this.onEndedCallback();
      }
    };
  }

  pause() {
    if (this.source && this.isPlaying) {
      // Calculate elapsed time taking playback rate into account
      const elapsed = this.audioContext.currentTime - this.startTime;
      this.pausedAt += elapsed * this.playbackRate;
      
      this.isPlaying = false; // Prevent onEnded from firing callback
      this.source.stop();
      this.source.disconnect();
      this.source = null;
    }
  }

  stop() {
    if (this.source) {
      if (this.isPlaying) {
        this.source.stop();
        this.source.disconnect();
      }
      this.isPlaying = false;
      this.pausedAt = 0;
    }
  }

  getFrequencyData(): Uint8Array {
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }

  getCurrentTime(): number {
    if (!this.buffer) return 0;
    if (this.isPlaying) {
      const now = this.audioContext.currentTime;
      // current position = pausedAt + (currentTime - startTime) * playbackRate
      return this.pausedAt + (now - this.startTime) * this.playbackRate;
    }
    return this.pausedAt;
  }
  
  getDuration(): number {
      return this.buffer ? this.buffer.duration : 0;
  }
}