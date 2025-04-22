import OpenAI from 'openai';
import dotenv from 'dotenv';

// dotenv is loaded in server.js, no need to load it again here.
// Ensure .env file exists in the 'backend' directory and contains OPENROUTER_API_KEY.

dotenv.config({ override: true }); // Load environment variables from .env file

const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    // Optional: Set headers if needed by OpenRouter or specific models
    // defaultHeaders: {
    //   "HTTP-Referer": $YOUR_SITE_URL, // Optional, for OpenRouter tracking
    //   "X-Title": $YOUR_SITE_NAME, // Optional, for OpenRouter tracking
    // },
});
/**
 * Call an LLM model via OpenRouter API
 * @param {Array} messages - Array of message objects with role and content properties
 * @param {boolean} jsonOutput - Whether to request JSON output from the LLM
 * @param {string} model - The model ID to use (defaults to google/gemini-2.0-flash-001)
 * @returns {string|Object} - Returns parsed JSON object if jsonOutput=true, otherwise string content
 */
async function callLLM(messages, jsonOutput = false, model = 'google/gemini-2.0-flash-001') {
    const options = {
        model: model, // Default to gemini-2.0-flash-001, but allow override
        messages: messages,
    };
    if (jsonOutput) {
        options.response_format = { type: 'json_object' };
        // Ensure the last message prompts for JSON output explicitly
        if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
            messages[messages.length - 1].content += "\n\nPlease respond ONLY in JSON format.";
        }
    }

    console.log('Calling LLM with options:', JSON.stringify(options, null, 2)); // Log request details

    try {
        const completion = await openai.chat.completions.create(options);
        console.log('LLM Response:', JSON.stringify(completion, null, 2)); // Log full response
        const content = completion.choices[0].message?.content;

        if (!content) {
            console.error("LLM returned empty content.");
            throw new Error("LLM returned empty content.");
        }

        if (jsonOutput) {
            try {
                let jsonString = content;

                // First attempt: Check for ```json ... ``` blocks
                const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
                if (jsonMatch) {
                    jsonString = jsonMatch[1];
                    console.log("Found JSON in ```json``` block");
                } else {
                    // Second attempt: Check for general ``` ... ``` blocks
                    const codeBlockMatch = content.match(/```\s*([\s\S]*?)\s*```/);
                    if (codeBlockMatch) {
                        jsonString = codeBlockMatch[1];
                        console.log("Found JSON in general ``` code block");
                    }
                }

                // Try to parse the extracted or raw content
                return JSON.parse(jsonString);
            } catch (e) {
                console.error("Failed to parse LLM JSON response:", content, e);
                // Return the raw content if JSON parsing fails, maybe it's just text
                // Or throw a specific error if JSON is strictly required
                throw new Error(`LLM did not return valid JSON. Raw response: ${content}`);
            }
        }
        return content;
    } catch (error) {
        console.error('Error calling OpenRouter:', error);
        // Implement retry logic if needed
        throw error;
    }
}

// Simple test function
async function testLLM(model) {
    console.log("Testing LLM connection...");
    if (!process.env.OPENROUTER_API_KEY) {
        console.error("OPENROUTER_API_KEY not found in environment variables. Make sure .env is loaded correctly from the project root.");
        return;
    }
    try {
        const response = await callLLM([{ role: "user", content: "Hello!" }], false, model);
        console.log(`LLM Test Response (${model || 'default model'}):`);
        console.log(response);
        return response;
    } catch (error) {
        console.error("LLM Test Failed:", error);
        throw error;
    }
}

// List of available models that work well with OpenRouter
const RECOMMENDED_MODELS = {
    'gemini-flash': 'google/gemini-2.0-flash-001',
    'gemini-pro': 'google/gemini-2.0-pro-001',
    'gemini-pro-vision': 'google/gemini-pro-vision',
    'claude-3-opus': 'anthropic/claude-3-opus:20240229',
    'claude-3-sonnet': 'anthropic/claude-3-sonnet:20240229',
    'claude-3-haiku': 'anthropic/claude-3-haiku:20240307',
    'gpt-4-turbo': 'openai/gpt-4-turbo-preview',
    'gpt-4': 'openai/gpt-4',
    'gpt-3.5-turbo': 'openai/gpt-3.5-turbo'
};

export { callLLM, testLLM, RECOMMENDED_MODELS };