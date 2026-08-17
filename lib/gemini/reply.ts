/**
 * lib/gemini/reply.ts
 *
 * Thin wrapper around Google's Gemini API (free tier, gemini-3.6-flash
 * model) for generating AI replies to inbound WhatsApp messages.
 */

export async function generateAIReply(userMessage: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable");
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: userMessage }],
          },
        ],
        generationConfig: {
          maxOutputTokens: 300,
          temperature: 0.7,
        },
      }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    console.error("Gemini API error:", JSON.stringify(data));
    throw new Error(data?.error?.message || "Gemini request failed");
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return text?.trim() || "Sorry, I'm having trouble responding right now. Someone from our team will get back to you shortly.";
}
