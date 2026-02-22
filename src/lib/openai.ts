/**
 * OpenAI — lowest-cost model (gpt-4o-mini) for generating subtasks.
 * Uses VITE_OPENAI_API_KEY from .env (set from OPENAI_API_KEY for dev).
 */

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY as string | undefined;
const MODEL = "gpt-4o-mini";

export function hasOpenAIKey(): boolean {
  return Boolean(OPENAI_API_KEY?.trim());
}

/**
 * Generate 3–5 subtask titles for a task. Returns empty array if no key or on error.
 */
export async function generateSubtasksWithOpenAI(taskTitle: string): Promise<{ title: string }[]> {
  if (!hasOpenAIKey()) return [];

  const system =
    "You are an event-planning assistant. Given a task title, respond with a JSON array of 3 to 5 concrete subtask titles. Each item must be an object with a single key \"title\" and a short string value. No other text or markdown.";
  const user = `Task: ${taskTitle}\nRespond with only a JSON array of objects with "title" key, e.g. [{"title":"Research options"},{"title":"Compare and decide"}]`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: 256,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn("OpenAI subtask generation failed:", res.status, err);
      return [];
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return [];

    const parsed = JSON.parse(content) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is { title: string } => item && typeof item === "object" && typeof (item as { title?: string }).title === "string")
      .slice(0, 8)
      .map((item) => ({ title: item.title }));
  } catch (e) {
    console.warn("OpenAI subtask generation error:", e);
    return [];
  }
}
