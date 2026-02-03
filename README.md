# Neuroadaptive AI Tutor - Technical Documentation

A research interface designed to study cognitive workload during AI-driven tutoring sessions. It dynamically generates educational content, assesses user comprehension, and allows for voice-based interruptions.

## 🚀 Running Locally

To run this project on your local machine, follow these steps:

### 1. Prerequisites
- **Node.js** (v18 or higher recommended)
- **Google Gemini API Key**: Obtain one from [Google AI Studio](https://aistudio.google.com/).

### 2. Setup
Clone or download this project to your local directory.

### 3. Environment Configuration
The application expects an environment variable named `API_KEY`. 

**Option A: Using Vite (Recommended)**
Vite is the easiest way to serve this project.
1. Create a `.env` file in the root directory:
   ```env
   VITE_API_KEY=your_gemini_api_key_here
   ```
2. In `services/geminiService.ts`, ensure you are accessing the key correctly (e.g., `import.meta.env.VITE_API_KEY` for Vite). *Note: The provided code uses `process.env.API_KEY` which is standard for many build environments.*

**Option B: Simple Dev Server**
If using a tool like `local-air` or a custom proxy that injects environment variables:
```bash
export API_KEY=your_api_key_here
npx serve
```

### 4. Installation & Execution
If you are using a standard build tool like Vite:
```bash
# Install dependencies (if using a package.json)
npm install

# Start the development server
npm run dev
```

If you just want to serve the files directly (assuming the API Key is handled):
```bash
# Using a simple static server
npx serve .
```

---

## 🛠 Tech Stack
*   **Frontend Framework:** React 19 (TypeScript)
*   **Styling:** Tailwind CSS (via CDN)
*   **AI Provider:** Google Gemini API (`@google/genai` SDK)
*   **Audio Processing:** Web Audio API
*   **State Management:** React Hooks (`useState`, `useEffect`, `useRef`)

---

## 🧠 Application Architecture

### 1. Core Services (`services/geminiService.ts`)
Handles all interactions with the Google Gemini API.
*   **Script Generation:** Uses `gemini-3-flash-preview` for educational text.
*   **Text-to-Speech (TTS):** Uses `gemini-2.5-flash-preview-tts` for high-quality audio output.
*   **Quiz Generation:** Uses structured JSON output to create comprehension assessments.
*   **Interruption Handling:** Process user audio and lesson context simultaneously.

### 2. Audio Engine (`utils/audio.ts`)
Decodes raw PCM data from the Gemini TTS model.
*   **PCM Decoding:** Converts `Int16Array` byte streams into floating-point audio.
*   **Visualizer:** Uses `AnalyserNode` for real-time frequency data.

### 3. Component Hierarchy
*   **`App.tsx`**: Main state machine.
*   **`components/TutoringSession.tsx`**: Session lifecycle hub.
*   **`components/AICharacter.tsx`**: Reactive avatar (Idle, Speaking, Listening, Thinking).
*   **`components/AudioVisualizer.tsx`**: Canvas-based frequency rendering.
*   **`components/NasaTlxForm.tsx`**: NASA Task Load Index assessment.

---

## 📝 Configuration
*   **Complexity:** Toggles between Simple (foundational) and Complex (technical) language.
*   **Pacing:** Toggles playback rate (1.0x vs 1.15x) and script length.

## 🎤 Permissions
This app requires **Microphone** access for the interruption/voice-chat feature. Ensure your browser allows microphone permissions for the local origin.