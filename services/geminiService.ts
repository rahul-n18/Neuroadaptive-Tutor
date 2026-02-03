
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

// PRE-SCRIPTED CONTENT for fixed topics to ensure faster generation and consistent quality
const PRE_SCRIPTED_CONTENT: Record<string, Record<string, string>> = {
  "Photosynthesis": {
    [TutoringComplexity.SIMPLE]: "Photosynthesis is how plants make their own food. Imagine plants are like little green chefs! They take three main ingredients: sunlight, water, and a gas from the air called carbon dioxide. Inside the plant's leaves, there are tiny green parts called chloroplasts. These chloroplasts act like solar panels, catching the sun's energy. They use this energy to mix the water and carbon dioxide together. This process creates a special kind of sugar called glucose, which is the plant's food. While making food, plants also release oxygen into the air, which is the very air we need to breathe! So, without photosynthesis, we wouldn't have food or oxygen. It is truly the most important process for life on our beautiful Earth.",
    [TutoringComplexity.COMPLEX]: "Photosynthesis is a sophisticated multi-stage biochemical process occurring primarily within the chloroplasts of photoautotrophs. It consists of two main phases: the light-dependent reactions and the light-independent Calvin cycle. During the light-dependent phase, chlorophyll molecules within the thylakoid membranes absorb photons, exciting electrons and initiating an electron transport chain. This leads to the photolysis of water, releasing oxygen as a byproduct and generating ATP and NADPH. These energy carriers then power the Calvin cycle in the stroma. Here, the enzyme Rubisco facilitates carbon fixation, incorporating atmospheric carbon dioxide into organic molecules. Through a series of reduction reactions, these molecules are ultimately transformed into glyceraldehyde-3-phosphate, the precursor for glucose and other essential carbohydrates, sustaining nearly all terrestrial trophic structures."
  },
  "Business Studies": {
    [TutoringComplexity.SIMPLE]: "Business is all about people working together to provide things that other people want or need. Think of a lemonade stand: you are the business owner. You buy lemons and sugar, which are your costs. Then you make lemonade and sell it for a price. If the money you get from selling is more than what you spent on ingredients, you have made a profit! Profit is important because it helps the business grow. Businesses can sell products, like toys and books, or services, like cutting hair or fixing cars. Every successful business starts with a good idea and a plan to reach customers who will value what you are offering.",
    [TutoringComplexity.COMPLEX]: "Business studies explores the dynamic organizational structures and economic principles that drive commercial activity. At its core, a firm aims to maximize shareholder value through efficient resource allocation and strategic positioning. This involves analyzing market structures, such as perfect competition or oligopolies, and understanding the supply-demand equilibrium. Strategic management tools, like SWOT analysis and Porter’s Five Forces, allow businesses to assess their competitive advantages. Financial management is equally critical, focusing on liquidity, capital structure, and the cost of debt versus equity. Furthermore, businesses must navigate external macroeconomic factors, including fiscal policies and global trade regulations, while maintaining corporate social responsibility to ensure long-term sustainability in an increasingly interconnected global marketplace."
  },
  "Climate Change": {
    [TutoringComplexity.SIMPLE]: "Climate change means that the Earth's average temperature is getting warmer over a long time. This is happening because of the greenhouse effect. Imagine the Earth is wearing a thick blanket made of gases like carbon dioxide. When we drive cars or use power from factories, we add more layers to that blanket, trapping too much of the sun's heat. This extra warmth is causing ice at the North and South Poles to melt, which makes the sea levels rise. It also causes more extreme weather, like very big storms or long droughts. By using cleaner energy like wind and solar power, and by recycling, we can help keep our planet's temperature stable and healthy for everyone.",
    [TutoringComplexity.COMPLEX]: "Climate change refers to significant, long-term shifts in global temperature and weather patterns, primarily driven by anthropogenic greenhouse gas emissions since the Industrial Revolution. The core mechanism is radiative forcing, where gases such as carbon dioxide and methane trap infrared radiation within the troposphere. This leads to a warming trend that triggers various feedback loops, such as the ice-albedo feedback, where melting polar ice reduces the Earth's reflectivity, accelerating further warming. Scientific consensus, supported by IPCC reports, indicates that these changes result in ocean acidification, rising sea levels due to thermal expansion and glacial melt, and increased frequency of extreme meteorological events. Mitigating these impacts requires a systemic transition to a low-carbon economy and robust international climate policy frameworks."
  }
};

// Retry Helper
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isRetryable = error.status >= 500 || error.message?.includes('Internal error') || error.message?.includes('Overloaded');
    if (retries > 0 && isRetryable) {
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
  // Check if we have a pre-scripted response for this topic
  if (PRE_SCRIPTED_CONTENT[topic] && PRE_SCRIPTED_CONTENT[topic][complexity]) {
    // Return the "already-scripted" response immediately to speed up initialization
    return PRE_SCRIPTED_CONTENT[topic][complexity];
  }

  // Fallback to LLM if topic is not pre-scripted (though UI restricts it now)
  return withRetry(async () => {
    const client = getClient();
    const complexityPrompt = complexity === TutoringComplexity.SIMPLE 
      ? "Use extremely simple vocabulary and short sentences for a 6th grader." 
      : "Use technical academic terminology and complex logic.";
    const lengthPrompt = pacing === TutoringPacing.FAST
      ? "Approximately 150 words long."
      : "Approximately 110 words long.";

    const prompt = `Write a plain text educational script about ${topic}. Level: ${complexity}. Instruction: ${complexityPrompt} ${lengthPrompt}`;

    const response = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return (response.text || "Failed to generate script.").replace(/\*+/g, '').trim();
  });
};

// 2. Generate Audio (TTS)
export const generateTutoringAudio = async (text: string): Promise<string> => {
  return withRetry(async () => {
    const client = getClient();
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
    if (!audioData) throw new Error("Failed to generate audio.");
    return audioData;
  });
};

// 3. Generate Quiz
export const generateQuiz = async (script: string): Promise<QuizQuestion[]> => {
  return withRetry(async () => {
    const client = getClient();
    const response = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Based on this text, generate 3 multiple-choice questions (1: Recall, 2: Conceptual, 3: Higher-order): "${script}"`,
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
    return JSON.parse(response.text || "[]");
  });
};

export const answerLearnerQuestion = async (contextScript: string, userAudioBase64: string): Promise<{userTranscript: string, aiAnswer: string, audioData: string}> => {
  return withRetry(async () => {
    const client = getClient();
    const prompt = `Answer student question based on context: "${contextScript}". Short answer (max 20 words).`;
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
    let result = JSON.parse(response.text || '{"userTranscript":"?","aiAnswer":"..."}');
    const audioData = await generateTutoringAudio(result.aiAnswer);
    return { ...result, audioData };
  });
};

export const generateAppBackground = async (): Promise<string> => {
  return withRetry(async () => {
    const client = getClient();
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: 'Abstract digital neural networks, dark blue and slate colors, high quality.' }] }
    });
    const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (part?.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    throw new Error("No image generated");
  });
};
