import OpenAI from "openai";

let client: OpenAI | null = null;

export function getOpenAI() {
  if (!client) {
    const key = process.env.OPENAI_API_KEY?.trim();
    if (!key) throw new Error("OPENAI_API_KEY is not configured");
    client = new OpenAI({ apiKey: key });
  }
  return client;
}
