
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

// --- CACHING STRATEGY TO REDUCE RPM ---
// We store generated content in memory so repeated requests for the same
// parameters do not hit the API limits.
const scriptCache = new Map<string, string>();
const audioCache = new Map<string, string>();
const quizCache = new Map<string, QuizQuestion[]>();
const AUDIO_CACHE_LIMIT = 10; // Limit large audio files in memory

// PRE-SCRIPTED CONTENT structured by complexity and pacing
const PRE_SCRIPTED_CONTENT: Record<string, Record<TutoringComplexity, Record<TutoringPacing, string>>> = {
  "Photosynthesis": {
    [TutoringComplexity.SIMPLE]: {
      [TutoringPacing.NORMAL]: "Photosynthesis is how plants make their own food. Imagine plants are like little green chefs! They take three main ingredients: sunlight, water, and a gas from the air called carbon dioxide. Inside the plant's leaves, there are tiny green parts called chloroplasts. These chloroplasts act like solar panels, catching the sun's energy. They use this energy to mix the water and carbon dioxide together. This process creates a special kind of sugar called glucose, which is the plant's food. While making food, plants also release oxygen into the air, which is the very air we need to breathe!",
      [TutoringPacing.FAST]: "Photosynthesis is the amazing way plants create their own fuel! They act like tiny solar-powered factories. Using sunlight, water, and carbon dioxide, plants perform a magical chemical reaction inside their leaves. Specifically, inside parts called chloroplasts, the sun's energy turns water and air into glucose—a sweet sugar that helps the plant grow tall and strong. As a bonus for us, plants release fresh oxygen back into the atmosphere. This cycle is the heartbeat of our planet, providing the food we eat and the very air we breathe every single second of the day."
    },
    [TutoringComplexity.COMPLEX]: {
      [TutoringPacing.NORMAL]: "Photosynthesis is a sophisticated multi-stage biochemical process occurring primarily within the chloroplasts of photoautotrophs. It consists of two main phases: the light-dependent reactions and the light-independent Calvin cycle. During the light-dependent phase, chlorophyll molecules within the thylakoid membranes absorb photons, exciting electrons and initiating an electron transport chain. This leads to the photolysis of water, releasing oxygen as a byproduct and generating ATP and NADPH. These energy carriers then power the Calvin cycle in the stroma to produce carbohydrates.",
      [TutoringPacing.FAST]: "Photosynthesis represents a pinnacle of biological engineering, transforming electromagnetic radiation into chemical energy. This complex redox process is partitioned into light-harvesting reactions and the enzymatic carbon-fixation of the Calvin cycle. In the thylakoid membranes, P680 and P700 reaction centers facilitate non-cyclic electron flow, driving the synthesis of ATP through chemiosmosis and the reduction of NADP+. Subsequently, in the stroma, the enzyme Rubisco catalyzes the fixation of CO2 into 3-phosphoglycerate. This metabolic pathway is not only responsible for the vast majority of biomass on Earth but also regulates the global carbon cycle and atmospheric oxygen levels, sustaining complex life across all terrestrial ecosystems."
    }
  },
  "Business Studies": {
    [TutoringComplexity.SIMPLE]: {
      [TutoringPacing.NORMAL]: "Business is all about people working together to provide things that other people want or need. Think of a lemonade stand: you buy lemons and sugar, which are your costs. Then you make lemonade and sell it for a price. If the money you get from selling is more than what you spent on ingredients, you have made a profit! Profit is important because it helps the business grow. Every successful business starts with a good idea and a plan to reach customers who will value what you are offering.",
      [TutoringPacing.FAST]: "Starting a business is like going on an adventure where you provide value to others. Whether you're selling a physical product like a handmade toy or a service like walking a dog, the goal is to solve a problem for your customers. You have to manage your expenses carefully—that's the money you spend on supplies—to ensure you make a profit. Profit allows you to buy better equipment and reach more people. Successful entrepreneurs constantly look for new ways to improve and grow, building strong relationships with their community and creating a brand that people trust and love."
    },
    [TutoringComplexity.COMPLEX]: {
      [TutoringPacing.NORMAL]: "Business studies explores the dynamic organizational structures and economic principles that drive commercial activity. At its core, a firm aims to maximize shareholder value through efficient resource allocation and strategic positioning. This involves analyzing market structures, such as perfect competition or oligopolies, and understanding the supply-demand equilibrium. Strategic management tools, like SWOT analysis and Porter’s Five Forces, allow businesses to assess their competitive advantages and navigate external macroeconomic factors.",
      [TutoringPacing.FAST]: "The study of business encompasses the intricate relationship between organizational behavior, financial strategy, and market dynamics. Contemporary firms must optimize their value chains through vertical or horizontal integration while navigating the complexities of global supply chains. Financial analysis relies on key metrics like the Weighted Average Cost of Capital and Net Present Value to guide investment decisions. Furthermore, the advent of digital transformation has redefined competitive landscapes, necessitating agile methodologies and robust data analytics. Understanding these systemic interactions is crucial for managing corporate governance, ensuring fiscal sustainability, and achieving long-term strategic objectives in a volatile global economy."
    }
  },
  "Climate Change": {
    [TutoringComplexity.SIMPLE]: {
      [TutoringPacing.NORMAL]: "Climate change means that the Earth's average temperature is getting warmer over a long time. This is happening because of the greenhouse effect. Imagine the Earth is wearing a thick blanket made of gases like carbon dioxide. When we drive cars or use power from factories, we add more layers to that blanket, trapping too much of the sun's heat. This extra warmth is causing ice at the North and South Poles to melt, which makes the sea levels rise and causes more extreme weather.",
      [TutoringPacing.FAST]: "Climate change is a global challenge where the Earth's temperature is rising faster than ever before. This warming is caused by the buildup of greenhouse gases which act like a giant greenhouse, trapping heat inside our atmosphere. Human activities, such as burning fossil fuels and cutting down forests, are the main drivers of this change. As the planet heats up, we see melting glaciers, rising oceans, and more frequent heatwaves and storms. However, by switching to clean energy like wind and solar and protecting our forests, we can work together to keep our planet cool and safe for future generations."
    },
    [TutoringComplexity.COMPLEX]: {
      [TutoringPacing.NORMAL]: "Climate change refers to significant, long-term shifts in global temperature and weather patterns, primarily driven by anthropogenic greenhouse gas emissions since the Industrial Revolution. The core mechanism is radiative forcing, where gases such as carbon dioxide and methane trap infrared radiation within the troposphere. This leads to a warming trend that triggers various feedback loops, such as the ice-albedo feedback, where melting polar ice reduces the Earth's reflectivity, accelerating further warming.",
      [TutoringPacing.FAST]: "Anthropogenic climate change is characterized by an unprecedented increase in global mean temperatures, primarily attributed to the combustion of hydrocarbons and land-use alterations. This phenomenon is driven by the enhanced greenhouse effect, where increased concentrations of trace gases disrupt the Earth's energy balance. Scientific modeling, including GCMs, indicates that exceeding the 1.5-degree Celsius threshold could trigger irreversible tipping points, such as the collapse of the Atlantic Meridional Overturning Circulation. Mitigation strategies require a rapid decarbonization of the energy sector, coupled with carbon sequestration and adaptive resilience policies. Addressing this systemic crisis is the defining environmental and geopolitical challenge of the twenty-first century."
    }
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
  const cacheKey = `${topic}-${complexity}-${pacing}`;
  
  if (scriptCache.has(cacheKey)) {
    return scriptCache.get(cacheKey)!;
  }

  // Check if we have a pre-scripted response for this topic, complexity, AND pacing
  if (PRE_SCRIPTED_CONTENT[topic] && PRE_SCRIPTED_CONTENT[topic][complexity] && PRE_SCRIPTED_CONTENT[topic][complexity][pacing]) {
    const content = PRE_SCRIPTED_CONTENT[topic][complexity][pacing];
    scriptCache.set(cacheKey, content);
    return content;
  }

  // Fallback to LLM if topic is not pre-scripted
  const result = await withRetry(async () => {
    const client = getClient();
    const complexityPrompt = complexity === TutoringComplexity.SIMPLE 
      ? "Use extremely simple vocabulary and short sentences for a 6th grader." 
      : "Use technical academic terminology and complex logic.";
      
    // Enforce distinct content differences for pacing beyond just length
    const lengthPrompt = pacing === TutoringPacing.FAST
      ? "Approximately 160 words long. Use a faster-paced narrative style with high information density."
      : "Approximately 100 words long. Use a relaxed, slower-paced narrative style with pauses for reflection.";

    const prompt = `Write a plain text educational script about ${topic}. Level: ${complexity}. Instruction: ${complexityPrompt} ${lengthPrompt}`;

    const response = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return (response.text || "Failed to generate script.").replace(/\*+/g, '').trim();
  });
  
  scriptCache.set(cacheKey, result);
  return result;
};

// 2. Generate Audio (TTS)
export const generateTutoringAudio = async (text: string): Promise<string> => {
  // Check cache (using text as key)
  if (audioCache.has(text)) {
    console.log("[GeminiService] Serving audio from cache to save RPM.");
    return audioCache.get(text)!;
  }

  const result = await withRetry(async () => {
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

  // Manage cache size
  if (audioCache.size >= AUDIO_CACHE_LIMIT) {
    const firstKey = audioCache.keys().next().value;
    if (firstKey) audioCache.delete(firstKey);
  }
  
  audioCache.set(text, result);
  return result;
};

// 3. Generate Quiz
export const generateQuiz = async (script: string): Promise<QuizQuestion[]> => {
  // Use script as cache key since quiz is derived from it
  if (quizCache.has(script)) {
    return quizCache.get(script)!;
  }

  const result = await withRetry(async () => {
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

  quizCache.set(script, result);
  return result;
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
    
    // This call is also cached if the answer text is identical to a previous one
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
