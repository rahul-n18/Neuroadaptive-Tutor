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
    
    const complexityPrompt = complexity === TutoringComplexity.SIMPLE 
      ? "Use simple language, foundational concepts, and short sentences suitable for a beginner." 
      : "Use technical terminology, dense syntax, and in-depth academic concepts suitable for an advanced student.";

    // Calculate target word count to ensure ~60 seconds of audio.
    // Average speaking rate is ~150 words per minute.
    // If Pacing is FAST, playback is 1.25x, so we need 1.25 * 150 = ~188 words to fill 1 minute.
    const lengthPrompt = pacing === TutoringPacing.FAST
      ? "The script must be approximately 190 words long. This specific length is required because the text will be read at 1.25x speed, resulting in exactly 60 seconds of audio."
      : "The script must be approximately 150 words long. This specific length is required to result in exactly 60 seconds of audio at a normal speaking rate.";

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
export const answerLearnerQuestion = async (contextScript: string, userAudioBase64: string): Promise<{text: string, audioData: string}> => {
  return withRetry(async () => {
    const client = getClient();
    
    // Step 4a: Get Text Answer using multimodal input (text context + user audio)
    const prompt = `
    You are an AI Tutor interrupting your lesson to answer a student's question.
    
    Context of the current lesson: "${contextScript}"
    
    Instruction: 
    1. Listen to the student's question in the audio.
    2. Answer the question in ONE SHORT SENTENCE (max 20 words).
    3. Be direct and encouraging.
    `;

    // We use gemini-3-flash-preview as it supports audio input and is fast
    const answerResponse = await client.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
            parts: [
                { text: prompt },
                { inlineData: { mimeType: 'audio/webm', data: userAudioBase64 } }
            ]
        }
    });
    
    const answerText = answerResponse.text || "I didn't quite catch that, could you repeat?";

    // Step 4b: TTS the Answer to match the tutor's voice
    const ttsResponse = await client.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ parts: [{ text: answerText }] }],
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

    return { text: answerText, audioData };
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