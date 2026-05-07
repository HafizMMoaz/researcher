import OpenAI from "openai";

export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  return new OpenAI({ apiKey });
}

export function getOpenAIModel() {
  return process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
}
