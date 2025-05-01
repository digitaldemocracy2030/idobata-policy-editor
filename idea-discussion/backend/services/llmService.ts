import dotenv from "dotenv";
import OpenAI from "openai";
import { ApiResponse, IChatMessage } from "../types/index.js";

dotenv.config({ override: true }); // Load environment variables from .env file

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/**
 * Call an LLM model via OpenRouter API
 * @param messages - Array of message objects with role and content properties
 * @param jsonOutput - Whether to request JSON output from the LLM
 * @param model - The model ID to use (defaults to google/gemini-2.0-flash-001)
 * @returns - Returns parsed JSON object if jsonOutput=true, otherwise string content
 */
async function callLLM(
  messages: ChatMessage[],
  jsonOutput = false,
  model = "google/gemini-2.0-flash-001"
): Promise<string | Record<string, unknown>> {
  // Define options without explicit typing to avoid OpenAI API type constraints
  const options = {
    model: model,
    messages: messages,
  };
  
  if (jsonOutput) {
    // @ts-ignore - Add response_format property for JSON output
    options.response_format = { type: "json_object" };
    if (messages.length > 0 && messages[messages.length - 1].role === "user") {
      messages[messages.length - 1].content +=
        "\n\nPlease respond ONLY in JSON format.";
    }
  }

  console.log("Calling LLM with options:", JSON.stringify(options, null, 2)); // Log request details

  try {
    // @ts-ignore - Bypass type checking for OpenAI API call
    const completion = await openai.chat.completions.create(options);
    console.log("LLM Response:", JSON.stringify(completion, null, 2)); // Log full response
    const content = completion.choices[0].message?.content;

    if (!content) {
      console.error("LLM returned empty content.");
      throw new Error("LLM returned empty content.");
    }

    if (jsonOutput) {
      try {
        let jsonString = content;

        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          jsonString = jsonMatch[1];
          console.log("Found JSON in ```json``` block");
        } else {
          const codeBlockMatch = content.match(/```\s*([\s\S]*?)\s*```/);
          if (codeBlockMatch) {
            jsonString = codeBlockMatch[1];
            console.log("Found JSON in general ``` code block");
          }
        }

        return JSON.parse(jsonString);
      } catch (e) {
        console.error("Failed to parse LLM JSON response:", content, e);
        throw new Error(
          `LLM did not return valid JSON. Raw response: ${content}`
        );
      }
    }
    return content;
  } catch (error) {
    console.error("Error calling OpenRouter:", error);
    throw error;
  }
}

async function testLLM(model?: string): Promise<string> {
  console.log("Testing LLM connection...");
  if (!process.env.OPENROUTER_API_KEY) {
    console.error(
      "OPENROUTER_API_KEY not found in environment variables. Make sure .env is loaded correctly from the project root."
    );
    throw new Error("OPENROUTER_API_KEY not found in environment variables");
  }
  try {
    const response = await callLLM(
      [{ role: "user", content: "Hello!" }],
      false,
      model
    );
    console.log(`LLM Test Response (${model || "default model"}):`);
    console.log(response);
    return response as string;
  } catch (error) {
    console.error("LLM Test Failed:", error);
    throw error;
  }
}

const RECOMMENDED_MODELS: Record<string, string> = {
  "gemini-flash": "google/gemini-2.0-flash-001",
  "gemini-pro": "google/gemini-2.0-pro-001",
  "gemini-pro-vision": "google/gemini-pro-vision",
  "claude-3-opus": "anthropic/claude-3-opus:20240229",
  "claude-3-sonnet": "anthropic/claude-3-sonnet:20240229",
  "claude-3-haiku": "anthropic/claude-3-haiku:20240307",
  "gpt-4-turbo": "openai/gpt-4-turbo-preview",
  "gpt-4": "openai/gpt-4",
  "gpt-3.5-turbo": "openai/gpt-3.5-turbo",
};

export { callLLM, testLLM, RECOMMENDED_MODELS };
