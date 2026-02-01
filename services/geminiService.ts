import { GoogleGenAI, Modality, Type } from "@google/genai";
import { TutoringComplexity, TutoringPacing, QuizQuestion } from "../types";

// Initialize Gemini Client
const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY environment variable is missing.");
  }
  return new GoogleGenAI({ apiKey });
};

// Retry Helper
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    // Retry on 5xx errors or specific "Internal error" messages
    const isRetryable = error.status >= 500 || error.message?.includes('Internal error') || error.message?.includes('Overloaded');
    
    if (retries > 0 && isRetryable) {
      console.warn(`Retrying API call... (${retries} attempts left). Error: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

// 1. Generate Tutoring Script
export const generateTutoringScript = async (
  topic: string,
  complexity: TutoringComplexity,
  pacing: TutoringPacing
): Promise<string> => {
  return withRetry(async () => {
    const client = getClient();
    
    // Updated complexity prompt to be much simpler (6th grade level)
    const complexityPrompt = complexity === TutoringComplexity.SIMPLE 
      ? "Use extremely simple vocabulary, short sentences, and clear analogies suitable for a 6th grade student (approx. 11-12 years old). Avoid complex jargon completely." 
      : "Use technical terminology, dense syntax, and in-depth academic concepts suitable for an advanced student.";

    // Calculate target word count to ensure ~60 seconds of audio.
    // Adjusted counts down to allow for slower playback speed and reduced cognitive load.
    // Normal speed is now 0.9x, so we target fewer words (approx 110-120) to keep it around 60s.
    const lengthPrompt = pacing === TutoringPacing.FAST
      ? "The script must be approximately 150 words long. This specific length is required for a faster reading pace."
      : "The script must be approximately 110 words long. This specific length is required to allow for a slow, relaxed, and deliberate reading pace.";

    const prompt = `
      You are an AI Tutor.
      Topic: ${topic}
      Level: ${complexity}
      Instruction: ${complexityPrompt}
      Task: Write a clear, educational explanation of the topic. ${lengthPrompt}
      Do not use markdown formatting like bold or headers, just plain text suitable for reading aloud.
      Strictly adhere to the word count to ensure the timing is correct.
    `;

    const response = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    const rawText = response.text || "Failed to generate script.";
    // Cleanup: Remove markdown bold/italic markers
    return rawText.replace(/\*+/g, '').trim();
  });
};

// 2. Generate Audio (TTS)
export const generateTutoringAudio = async (text: string): Promise<string> => {
  if (!text || text.length === 0) {
    throw new Error("Cannot generate audio for empty text.");
  }

  return withRetry(async () => {
    const client = getClient();
    
    // Using the specific TTS model as requested in prompt instructions
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioData) {
      throw new Error("Failed to generate audio.");
    }
    return audioData;
  });
};

// 3. Generate Quiz
export const generateQuiz = async (script: string): Promise<QuizQuestion[]> => {
  return withRetry(async () => {
    const client = getClient();
    const prompt = `
      Based on the following explanation, generate 3 multiple-choice comprehension questions.
      
      Explanation: "${script}"

      Output JSON format:
      [
        {
          "question": "Question text",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correctIndex": 0 // index of correct option (0-3)
        }
      ]
    `;

    const response = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctIndex: { type: Type.INTEGER },
            },
            required: ["question", "options", "correctIndex"]
          },
        },
      },
    });

    try {
      const text = response.text || "[]";
      return JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse quiz JSON", e);
      return [];
    }
  });
};

// 4. Answer Learner Question (Interruption)
export const answerLearnerQuestion = async (contextScript: string, userAudioBase64: string): Promise<{userTranscript: string, aiAnswer: string, audioData: string}> => {
  return withRetry(async () => {
    const client = getClient();
    
    // Step 4a: Get Text Answer using multimodal input (text context + user audio)
    // We request JSON so we can extract both the Transcription (what user said) and the Answer
    const prompt = `
    You are an AI Tutor interrupting your lesson to answer a student's question.
    
    Context of the current lesson: "${contextScript}"
    
    Instruction: 
    1. Listen to the student's question in the audio.
    2. Transcribe exactly what the student asked.
    3. Answer the question in ONE SHORT SENTENCE (max 20 words).
    4. Be direct and encouraging.
    `;

    const response = await client.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
            parts: [
                { text: prompt },
                { inlineData: { mimeType: 'audio/webm', data: userAudioBase64 } }
            ]
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    userTranscript: { type: Type.STRING },
                    aiAnswer: { type: Type.STRING }
                }
            }
        }
    });
    
    let result = { userTranscript: "Unknown", aiAnswer: "I didn't catch that." };
    try {
        if (response.text) {
            result = JSON.parse(response.text);
        }
    } catch (e) {
        console.error("Failed to parse answer JSON", e);
    }

    // Step 4b: TTS the Answer to match the tutor's voice
    const ttsResponse = await client.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ parts: [{ text: result.aiAnswer }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const audioData = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioData) {
      throw new Error("Failed to generate answer audio");
    }

    return { 
        userTranscript: result.userTranscript, 
        aiAnswer: result.aiAnswer, 
        audioData 
    };
  });
};

// 5. Generate App Background
export const generateAppBackground = async (): Promise<string> => {
  return withRetry(async () => {
    const client = getClient();
    // Prompt optimized for gemini-2.5-flash-image
    const prompt = "Futuristic dark blue background with subtle glowing neural network connections. Digital art, abstract, high quality, 4k. Minimalist, suitable for app background.";
    
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        imageConfig: {
            aspectRatio: "16:9",
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    
    throw new Error("No image generated");
  });
};