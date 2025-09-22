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
 * Handles POST requests to /api/gemini.
 * This function acts as a secure proxy to the Google Gemini API.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    // 1. Parse the incoming request body from the frontend
    const body: GeminiProxyRequest = await request.json();
    const { endpoint, payload, userApiKey } = body;

    // 2. Determine which API key to use
    // - Prioritize the user-provided key.
    // - Fall back to the default key stored securely in Cloudflare's environment variables.
    const apiKey = userApiKey?.trim() || env.API_KEY;

    if (!apiKey) {
      // If no key is available at all, return a clear error.
      return new Response(
        JSON.stringify({ error: "NO_API_KEY: API Key không được cấu hình trên máy chủ." }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Construct the full URL for the Google API endpoint
    let apiUrl = `${GOOGLE_API_BASE_URL}/models/${payload.model}:${endpoint}`;
    
    // Special case for the validation endpoint which has a different URL structure
    if (endpoint === 'validate') {
      apiUrl = `${GOOGLE_API_BASE_URL}/models/gemini-2.5-flash`;
    }

    // 4. Make the actual request to the Google API
    const googleResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey, // Use the API key in the header
      },
      // Pass the payload from the frontend directly to Google
      body: endpoint !== 'validate' ? JSON.stringify(payload) : undefined,
    });

    // 5. Handle the response from Google
    if (!googleResponse.ok) {
      // If Google returns an error, forward the error details to the frontend
      const errorData = await googleResponse.json();
      return new Response(
        JSON.stringify({ error: errorData?.error?.message || 'Lỗi không xác định từ Google API.' }),
        { status: googleResponse.status, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // 6. If successful, forward the successful response from Google back to the frontend
    const data = await googleResponse.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

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
