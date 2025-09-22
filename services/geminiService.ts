import { GoogleGenAI, Modality, Type } from "@google/genai";

const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve, reject) => {
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
  
  const data = await base64EncodedDataPromise;
  return {
    inlineData: {
      data,
      mimeType: file.type,
    },
  };
};

const dataUrlToGenerativePart = async (dataUrl: string) => {
  const base64Data = dataUrl.split(',')[1];
  const mimeType = dataUrl.match(/:(.*?);/)?.[1] ?? 'image/png';
  return {
    inlineData: {
      data: base64Data,
      mimeType: mimeType,
    },
  };
};

const getApiKey = (userApiKey?: string | null): string => {
    // Chỉ sử dụng duy nhất key do người dùng cung cấp trong cài đặt.
    // Điều này đảm bảo hành vi nhất quán trên mọi môi trường.
    if (userApiKey && userApiKey.trim() !== '') {
        return userApiKey.trim();
    }
    // Nếu không có key từ người dùng, ứng dụng sẽ báo lỗi và yêu cầu họ cung cấp.
    throw new Error("NO_API_KEY");
}

export const validateApiKey = async (apiKey: string): Promise<{ success: boolean; error?: string }> => {
    const trimmedApiKey = apiKey.trim();
    if (!trimmedApiKey) {
        return { success: false, error: "API Key không được để trống." };
    }
    
    // Sử dụng một endpoint cụ thể hơn để xác thực key bằng cách tìm nạp thông tin chi tiết của một model đã biết.
    // Điều này có thể đáng tin cậy hơn là liệt kê tất cả các model.
    const validationUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash?key=${trimmedApiKey}`;

    try {
        const response = await fetch(validationUrl);

        if (response.ok) {
            // Nếu response.ok là true (status 200-299), key hợp lệ.
            return { success: true };
        } else {
            // Nếu key không hợp lệ, Google API sẽ trả về lỗi.
            const errorData = await response.json();
            const errorMessage = errorData?.error?.message || `Lỗi ${response.status}: ${response.statusText}`;
            return { success: false, error: `Key không hợp lệ. Phản hồi từ Google: ${errorMessage}` };
        }
    } catch (error) {
        // Bắt lỗi mạng hoặc các lỗi khác không liên quan đến API.
        if (error instanceof Error) {
            return { success: false, error: `Không thể kết nối đến máy chủ Google để xác thực Key. Lỗi: ${error.message}` };
        }
        return { success: false, error: "Lỗi không xác định khi kết nối để xác thực Key." };
    }
};


export const generateTrendImage = async (images: File[], prompt: string, userApiKey?: string | null): Promise<string> => {
  const apiKey = getApiKey(userApiKey);
  const ai = new GoogleGenAI({ apiKey });

  const imageParts = await Promise.all(images.map(fileToGenerativePart));
  const textPart = { text: prompt };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: {
        parts: [...imageParts, textPart],
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
        // Iterate through parts to find the image data, as per Gemini guidelines.
        for (const part of firstCandidate.content.parts) {
            if (part.inlineData) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
    }
    
    // If no image part is found, throw an error with the model's text response.
    const textResponse = response.text || 'Không nhận được phản hồi hợp lệ từ mô hình.';
    throw new Error(`MODEL_ERROR: ${textResponse}`);
  } catch (error) {
    // Re-throw the error to be handled by the UI component
    throw error;
  }
};

export const enhanceImage = async (imageDataUrl: string, quality: 'HD' | '2K' | '4K', userApiKey?: string | null): Promise<string> => {
  const apiKey = getApiKey(userApiKey);
  const ai = new GoogleGenAI({ apiKey });

  const imagePart = await dataUrlToGenerativePart(imageDataUrl);
  
  const promptText = `Hoạt động như một công cụ phục hồi và nâng cấp ảnh chuyên nghiệp. Nâng cấp hình ảnh này lên độ phân giải ${quality} bằng các thuật toán siêu phân giải. Làm sắc nét các chi tiết, loại bỏ nhiễu và các tạo tác, đồng thời cải thiện độ rõ nét tổng thể mà không làm thay đổi bố cục hoặc chủ thể ban đầu. Hình ảnh cuối cùng phải rõ ràng và chi tiết hơn đáng kể.`;

  const textPart = { text: promptText };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: {
        parts: [imagePart, textPart],
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
        // Iterate through parts to find the image data.
        for (const part of firstCandidate.content.parts) {
            if (part.inlineData) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
    }

    // If no image part is found, throw an error with the model's text response.
    const textResponse = response.text || 'Không nhận được phản hồi hợp lệ từ mô hình.';
    throw new Error(`MODEL_ERROR: ${textResponse}`);
  } catch (error) {
    // Re-throw the error to be handled by the UI component
    throw error;
  }
};


export const generateImageFromText = async (prompt: string, userApiKey?: string | null): Promise<string> => {
  const apiKey = getApiKey(userApiKey);
  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/png',
      },
    });
    
    const base64ImageBytes = response.generatedImages?.[0]?.image?.imageBytes;

    if (base64ImageBytes) {
      return `data:image/png;base64,${base64ImageBytes}`;
    }

    throw new Error('MODEL_ERROR: Không nhận được ảnh từ mô hình.');
  } catch (error) {
    throw error;
  }
};

export const generatePromptVariations = async (basePrompt: string, count: number, userApiKey?: string | null): Promise<string[]> => {
    const apiKey = getApiKey(userApiKey);
    const ai = new GoogleGenAI({ apiKey });

    const systemInstruction = `You are a creative assistant specializing in generating diverse and interesting variations of image generation prompts. The user will provide a base prompt and a number. Your task is to rewrite the prompt that many times, introducing unique elements like different art styles, lighting, composition, or context. Ensure the core subject of the original prompt is maintained. The output must be a JSON array of strings, with each string being a distinct prompt variation. Do not include the original prompt in the output. The array must contain exactly the number of variations requested.`;

    const userContent = `Base Prompt: "${basePrompt}"\nNumber of variations: ${count}`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: userContent }] },
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

        const jsonString = response.text.trim();
        const variations = JSON.parse(jsonString);

        if (!Array.isArray(variations) || !variations.every(item => typeof item === 'string')) {
            throw new Error("MODEL_ERROR: AI did not return a valid array of prompt strings.");
        }
        
        return variations;

    } catch (error) {
        console.error("Error generating prompt variations:", error);
        throw error;
    }
};