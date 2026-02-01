# Neuroadaptive AI Tutor - Technical Documentation

## Overview
The **Neuroadaptive AI Tutor** is a React-based research interface designed to study cognitive workload during AI-driven tutoring sessions. It dynamically generates educational content, assesses user comprehension, and allows for voice-based interruptions, all while maintaining a specific visual and auditory aesthetic.

## Tech Stack
*   **Frontend Framework:** React 19 (TypeScript)
*   **Styling:** Tailwind CSS
*   **AI Provider:** Google Gemini API (`@google/genai` SDK)
*   **Audio Processing:** Web Audio API (Native Browser API)
*   **State Management:** React Hooks (`useState`, `useEffect`, `useRef`)

---

## Application Architecture

### 1. Core Services (`services/geminiService.ts`)
This service layer handles all interactions with the Google Gemini API. It abstracts the complex prompt engineering and configuration required for different modalities.

*   **Script Generation:** Uses `gemini-3-flash-preview` to generate educational text based on Topic, Complexity (Simple/Complex), and Pacing. It strictly controls word count to align with audio duration targets.
*   **Text-to-Speech (TTS):** Uses `gemini-2.5-flash-preview-tts` to convert the generated script into high-quality audio.
*   **Quiz Generation:** Uses `gemini-3-flash-preview` with `responseSchema` to guarantee a strictly formatted JSON output for multiple-choice questions.
*   **Visual Generation:** Uses `gemini-2.5-flash-image` to generate a thematic background image on app load.
*   **Interruption Handling:** Uses multimodal capabilities of `gemini-3-flash-preview` to process user audio input and generate a text response, which is then sent to the TTS model.

### 2. Audio Engine (`utils/audio.ts`)
The Gemini TTS model returns raw PCM (Pulse Code Modulation) data without standard WAV headers. The app implements a custom audio engine to handle this:
*   **Raw PCM Decoding:** Manually converts the `Int16Array` byte stream into floating-point audio data (`-1.0` to `1.0`) required by the Web Audio API.
*   **Visualizer:** Connects an `AnalyserNode` to the audio source to generate real-time frequency data for the UI visualizer.
*   **Playback Control:** Manually handles play, pause, resume, and playback rate adjustments (1.0x for Normal, 1.25x for Fast pacing).

### 3. Component Hierarchy
*   **`App.tsx`**: Main state machine. Manages high-level states (Welcome, Setup, Session, Finished).
*   **`components/TutoringSession.tsx`**: The core logic hub. It orchestrates the "Loading -> Playing -> Interruption -> Quiz" lifecycle.
*   **`components/AICharacter.tsx`**: A CSS-based reactive avatar that changes states (Idle, Speaking, Listening, Thinking) based on the session status.
*   **`components/AudioVisualizer.tsx`**: Renders the frequency data from the audio engine onto an HTML5 Canvas.
*   **`components/NasaTlxForm.tsx`**: Implements the NASA Task Load Index for subjective workload assessment.

---

## Detailed Workflows

### A. The Lesson Generation Pipeline
When a user starts a session:
1.  **Scripting:** A prompt is sent to Gemini asking for an explanation of the topic.
    *   *Constraint:* If "Fast" pacing is selected, the word count is increased to ~190 words (vs ~150) to ensure the audio lasts 60 seconds when played at 1.25x speed.
2.  **Synthesis:** The text is sent to the TTS model (`voiceName: 'Kore'`).
3.  **Assessment:** Simultaneously, the text is sent back to Gemini to generate 3 multiple-choice questions in JSON format.
4.  **Buffering:** The raw audio bytes are decoded into an AudioBuffer and loaded into the `AudioPlayer` class.

### B. The Interruption Logic
The app allows the user to interrupt the AI tutor verbally:
1.  **Record:** The user clicks "Interrupt". The app pauses the main audio and uses `MediaRecorder` to capture microphone input.
2.  **Send:** The recorded audio blob is converted to Base64 and sent to `gemini-3-flash-preview` along with the current lesson script as context.
3.  **Reason:** The model listens to the audio, understands the question, and generates a concise text answer.
4.  **Reply:** The answer text is sent to the TTS model to generate an audio response.
5.  **Resume:** The answer plays, and upon completion, the main lesson resumes from where it was paused.

---

## Configuration & Customization
The application behavior is defined in `types.ts` and allows for:
*   **Complexity:** Toggles prompt instructions between "Simple language/foundational concepts" and "Technical terminology/dense syntax".
*   **Pacing:** Toggles playback rate between 1.0x and 1.25x, and adjusts script length generation accordingly.

## Installation
1.  Ensure `process.env.API_KEY` is populated with a valid Google Gemini API Key.
2.  Run via a standard React build environment (Vite/CRA) or serve the ES modules as configured in `index.html`.
