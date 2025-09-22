import { GoogleGenAI, Modality, Type, GenerateContentResponse } from "@google/genai";

// This is a new type definition for the backend proxy payload
interface GeminiProxyRequest {
  endpoint: string;
  payload: any;
  userApiKey?: string | null;
}

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


// --- Central API Proxy Function ---

/**
 * A centralized function to call our backend proxy, which then calls the Google Gemini API.
 * This approach solves CORS issues and keeps the default API key secure on the server.
 * @param endpoint The specific Gemini API endpoint to hit (e.g., 'generateContent', 'generateImages').
 * @param payload The data to send to the Gemini API.
 * @param userApiKey An optional API key provided by the user.
 * @returns The JSON response from the Gemini API.
 */
async function callGeminiApi(endpoint: string, payload: any, userApiKey?: string | null): Promise<any> {
    try {
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ endpoint, payload, userApiKey } as GeminiProxyRequest),
        });

        if (!response.ok) {
            const errorData = await response.json();
            // Re-throw an error with the message from the backend/Google API
            throw new Error(errorData.error || `Lỗi ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        // Catch network errors (e.g., failed to connect to our own proxy)
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
             throw new Error('NETWORK_ERROR: Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại mạng.');
        }
        // Re-throw other errors to be handled by the UI
        throw error;
    }
}


// --- Public Service Functions (Refactored to use the proxy) ---

export const validateApiKey = async (apiKey: string): Promise<{ success: boolean; error?: string }> => {
    const trimmedApiKey = apiKey.trim();
    if (!trimmedApiKey) {
        return { success: false, error: "API Key không được để trống." };
    }
    
    try {
        // We validate by trying to fetch a model's details via our proxy
        await callGeminiApi('validate', {}, trimmedApiKey);
        return { success: true };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Lỗi không xác định.";
        return { success: false, error: `Key không hợp lệ. Phản hồi từ Google: ${errorMessage}` };
    }
};

export const generateTrendImage = async (images: File[], prompt: string, userApiKey?: string | null): Promise<string> => {
    const imageParts = await Promise.all(images.map(async (file) => ({
        inlineData: {
            data: await fileToBase64(file),
            mimeType: file.type,
        },
    })));

    const payload = {
        model: 'gemini-2.5-flash-image-preview',
        contents: {
            parts: [...imageParts, { text: prompt }],
        },
        generationConfig: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    };

    const response: GenerateContentResponse = await callGeminiApi('generateContent', payload, userApiKey);
    
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


export const enhanceImage = async (imageDataUrl: string, quality: 'HD' | '2K' | '4K', userApiKey?: string | null): Promise<string> => {
    const imagePart = {
        inlineData: {
            data: dataUrlToBase64(imageDataUrl),
            mimeType: getMimeTypeFromDataUrl(imageDataUrl),
        },
    };
  
    const promptText = `Hoạt động như một công cụ phục hồi và nâng cấp ảnh chuyên nghiệp. Nâng cấp hình ảnh này lên độ phân giải ${quality} bằng các thuật toán siêu phân giải. Làm sắc nét các chi tiết, loại bỏ nhiễu và các tạo tác, đồng thời cải thiện độ rõ nét tổng thể mà không làm thay đổi bố cục hoặc chủ thể ban đầu. Hình ảnh cuối cùng phải rõ ràng và chi tiết hơn đáng kể.`;

    const payload = {
        model: 'gemini-2.5-flash-image-preview',
        contents: {
            parts: [imagePart, { text: promptText }],
        },
        generationConfig: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    };
    
    const response: GenerateContentResponse = await callGeminiApi('generateContent', payload, userApiKey);

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


export const generateImageFromText = async (prompt: string, userApiKey?: string | null): Promise<string> => {
    const payload = {
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        numberOfImages: 1,
        outputMimeType: 'image/png',
    };

    const response = await callGeminiApi('generateImages', payload, userApiKey);
    const base64ImageBytes = response.generatedImages?.[0]?.image?.imageBytes;

    if (base64ImageBytes) {
      return `data:image/png;base64,${base64ImageBytes}`;
    }

    throw new Error('MODEL_ERROR: Không nhận được ảnh từ mô hình.');
};

export const generatePromptVariations = async (basePrompt: string, count: number, userApiKey?: string | null): Promise<string[]> => {
    const systemInstruction = `You are a creative assistant specializing in generating diverse and interesting variations of image generation prompts. The user will provide a base prompt and a number. Your task is to rewrite the prompt that many times, introducing unique elements like different art styles, lighting, composition, or context. Ensure the core subject of the original prompt is maintained. The output must be a JSON array of strings, with each string being a distinct prompt variation. Do not include the original prompt in the output. The array must contain exactly the number of variations requested.`;
    const userContent = `Base Prompt: "${basePrompt}"\nNumber of variations: ${count}`;

    const payload = {
        model: "gemini-2.5-flash",
        contents: { parts: [{ text: userContent }] },
        systemInstruction: systemInstruction,
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.STRING,
                    description: "A unique variation of the original image generation prompt."
                }
            },
        },
    };
    
    const response: GenerateContentResponse = await callGeminiApi('generateContent', payload, userApiKey);

    try {
        const jsonString = response.text.trim();
        const variations = JSON.parse(jsonString);

        if (!Array.isArray(variations) || !variations.every(item => typeof item === 'string')) {
            throw new Error("MODEL_ERROR: AI did not return a valid array of prompt strings.");
        }
        
        return variations;
    } catch (error) {
         console.error("Error parsing prompt variations from AI response:", error);
         // Throw a more specific error if parsing fails
         throw new Error("MODEL_ERROR: Phản hồi từ AI không phải là một định dạng JSON hợp lệ.");
    }
};