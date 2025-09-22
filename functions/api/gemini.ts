// Define types for Cloudflare environment and request body
// This helps with type safety and autocompletion.
interface Env {
  API_KEY: string;
}

// Add type definition for PagesFunction to fix compilation error.
type PagesFunction<E = any> = (context: {
    request: Request;
    env: E;
}) => Response | Promise<Response>;

interface GeminiProxyRequest {
  endpoint: string;
  payload: any;
  userApiKey?: string | null;
}

// Base URL for all Google Generative AI API calls
const GOOGLE_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

/**
 * A robust error handler that reads the response body as text first
 * to avoid JSON parsing errors on empty or non-JSON bodies.
 */
async function handleGoogleError(response: Response): Promise<Response> {
    const errorText = await response.text();
    let errorMessage = 'Lỗi không xác định từ Google API.';
    try {
        // Try to parse the text as JSON
        const errorData = JSON.parse(errorText);
        errorMessage = errorData?.error?.message || errorMessage;
    } catch (e) {
        // If parsing fails, use the raw text if it's not empty
        if (errorText) {
            errorMessage = errorText;
        }
    }
    return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
    );
}


/**
 * Handles POST requests to /api/gemini.
 * This function acts as a secure proxy to the Google Gemini API.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    // 1. Parse the incoming request body from the frontend
    const body: GeminiProxyRequest = await request.json();
    const { endpoint, payload, userApiKey } = body;

    // 2. Determine which API key to use
    const apiKey = userApiKey?.trim() || env.API_KEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "NO_API_KEY: API Key không được cấu hình trên máy chủ." }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Handle different endpoints
    if (endpoint === 'validate') {
        // The validation endpoint is a GET request to a specific model URL.
        const validationUrl = `${GOOGLE_API_BASE_URL}/models/gemini-2.5-flash?key=${apiKey}`;
        
        const googleResponse = await fetch(validationUrl, {
            method: 'GET',
        });

        if (!googleResponse.ok) {
            return handleGoogleError(googleResponse);
        }

        const data = await googleResponse.json();
        return new Response(JSON.stringify(data), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } else {
        // Handle all other endpoints (generateContent, generateImages, etc.) which are POST.
        const apiUrl = `${GOOGLE_API_BASE_URL}/models/${payload.model}:${endpoint}?key=${apiKey}`;
        
        // Create a new payload for Google, excluding our internal 'model' property.
        const googlePayload = { ...payload };
        delete googlePayload.model;

        const googleResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(googlePayload),
        });

        if (!googleResponse.ok) {
            return handleGoogleError(googleResponse);
        }
        
        const data = await googleResponse.json();
        return new Response(JSON.stringify(data), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    }

  } catch (error) {
    // Catch any unexpected errors during the process
    console.error('Lỗi tại máy chủ proxy:', error);
    const errorMessage = error instanceof Error ? error.message : 'Lỗi không xác định.';
    return new Response(
      JSON.stringify({ error: `Lỗi máy chủ proxy: ${errorMessage}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};