import { GoogleGenAI, Modality, Type, GenerateContentResponse } from "@google/genai";

// --- Helper Functions to prepare data for the model ---

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1]);
      } else {
        reject(new Error('Failed to read file as data URL.'));
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

const dataUrlToBase64 = (dataUrl: string): string => {
  return dataUrl.split(',')[1];
};

const getMimeTypeFromDataUrl = (dataUrl: string): string => {
  return dataUrl.match(/:(.*?);/)?.[1] ?? 'image/png';
};

// --- Central API Client Instantiation ---

/**
 * Gets an initialized GoogleGenAI instance.
 * Throws an error if the API key is missing.
 * @param apiKey The user's API key.
 * @returns An instance of GoogleGenAI.
 */
const getAi = (apiKey: string | null): GoogleGenAI => {
    const key = apiKey?.trim();
    if (!key) {
        throw new Error("NO_API_KEY");
    }
    return new GoogleGenAI({ apiKey: key });
};


// --- Public Service Functions (Refactored to call Gemini API directly) ---

export const validateApiKey = async (apiKey: string): Promise<{ success: boolean; error?: string }> => {
    const trimmedApiKey = apiKey.trim();
    if (!trimmedApiKey) {
        return { success: false, error: "API Key không được để trống." };
    }
    
    try {
        // Validate by fetching model details, a simple, low-cost GET request.
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash?key=${trimmedApiKey}`);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData?.error?.message || `Lỗi ${response.status}`);
        }
        
        return { success: true };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Lỗi không xác định.";
        return { success: false, error: `Key không hợp lệ. Phản hồi từ Google: ${errorMessage}` };
    }
};

export const generateTrendImage = async (images: File[], prompt: string, userApiKey: string | null): Promise<string> => {
    const ai = getAi(userApiKey);

    const imageParts = await Promise.all(images.map(async (file) => ({
        inlineData: {
            data: await fileToBase64(file),
            mimeType: file.type,
        },
    })));

    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: {
            parts: [...imageParts, { text: prompt }],
        },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });
    
    if (response.candidates?.[0]?.finishReason === 'SAFETY') {
        throw new Error('SAFETY');
    }

    const firstCandidate = response.candidates?.[0];
    if (firstCandidate?.content?.parts) {
        for (const part of firstCandidate.content.parts) {
            if (part.inlineData) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
    }
    
    const textResponse = response.text || 'Không nhận được phản hồi hợp lệ từ mô hình.';
    throw new Error(`MODEL_ERROR: ${textResponse}`);
};


export const enhanceImage = async (imageDataUrl: string, quality: 'HD' | '2K' | '4K', userApiKey: string | null): Promise<string> => {
    const ai = getAi(userApiKey);
    const imagePart = {
        inlineData: {
            data: dataUrlToBase64(imageDataUrl),
            mimeType: getMimeTypeFromDataUrl(imageDataUrl),
        },
    };
  
    const promptText = `Hoạt động như một công cụ phục hồi và nâng cấp ảnh chuyên nghiệp. Nâng cấp hình ảnh này lên độ phân giải ${quality} bằng các thuật toán siêu phân giải. Làm sắc nét các chi tiết, loại bỏ nhiễu và các tạo tác, đồng thời cải thiện độ rõ nét tổng thể mà không làm thay đổi bố cục hoặc chủ thể ban đầu. Hình ảnh cuối cùng phải rõ ràng và chi tiết hơn đáng kể.`;

    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: {
            parts: [imagePart, { text: promptText }],
        },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });
    
    if (response.candidates?.[0]?.finishReason === 'SAFETY') {
        throw new Error('SAFETY');
    }

    const firstCandidate = response.candidates?.[0];
    if (firstCandidate?.content?.parts) {
        for (const part of firstCandidate.content.parts) {
            if (part.inlineData) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
    }

    const textResponse = response.text || 'Không nhận được phản hồi hợp lệ từ mô hình.';
    throw new Error(`MODEL_ERROR: ${textResponse}`);
};


export const generateImageFromText = async (prompt: string, userApiKey: string | null): Promise<string> => {
    const ai = getAi(userApiKey);

    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/png',
        }
    });

    const base64ImageBytes = response.generatedImages?.[0]?.image?.imageBytes;

    if (base64ImageBytes) {
      return `data:image/png;base64,${base64ImageBytes}`;
    }

    throw new Error('MODEL_ERROR: Không nhận được ảnh từ mô hình.');
};

export const generatePromptVariations = async (basePrompt: string, count: number, userApiKey: string | null): Promise<string[]> => {
    const ai = getAi(userApiKey);
    
    const systemInstruction = `You are a creative assistant specializing in generating diverse and interesting variations of image generation prompts. The user will provide a base prompt and a number. Your task is to rewrite the prompt that many times, introducing unique elements like different art styles, lighting, composition, or context. Ensure the core subject of the original prompt is maintained. The output must be a JSON array of strings, with each string being a distinct prompt variation. Do not include the original prompt in the output. The array must contain exactly the number of variations requested.`;
    const userContent = `Base Prompt: "${basePrompt}"\nNumber of variations: ${count}`;

    const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: userContent,
        config: {
            systemInstruction: systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.STRING,
                    description: "A unique variation of the original image generation prompt."
                }
            },
        },
    });

    try {
        const jsonString = response.text.trim();
        const variations = JSON.parse(jsonString);

        if (!Array.isArray(variations) || !variations.every(item => typeof item === 'string')) {
            throw new Error("MODEL_ERROR: AI did not return a valid array of prompt strings.");
        }
        
        return variations;
    } catch (error) {
         console.error("Error parsing prompt variations from AI response:", error);
         throw new Error("MODEL_ERROR: Phản hồi từ AI không phải là một định dạng JSON hợp lệ.");
    }
};
