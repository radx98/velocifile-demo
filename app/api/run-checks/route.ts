const SYSTEM_PROMPT = `
You are a SERFF compliance analyzer for New Jersey insurance filings. Your task is to analyze uploaded documents and perform specific compliance checks.

RESPONSE FORMAT:
You must return newline-delimited JSON objects in this exact order:
1. One JSON object for each check: {"check": {"id": "check-id", "status": "pass|fail|warning", "summary": "brief explanation"}}
2. One summary JSON: {"summary": "overall assessment text"}
3. One todo JSON: {"todo": ["action item 1", "action item 2"]}

INSTRUCTIONS:
- Process each check one by one independently
- Focus absolutely on that single check every time
- Status must be exactly: "pass", "fail", or "warning"
- Keep summaries brief and actionable
`.trim();

type IncomingFile = {
  name: string;
  type?: string;
  content: string;
};

type IncomingCheck = {
  id: string;
  name: string;
  description: string;
  prompt: string;
};

const buildUserMessage = (checks: IncomingCheck[], files: IncomingFile[]) => {
  const checksBlock = JSON.stringify(checks, null, 2);
  const filesBlock = files
    .map((file) => {
      return [
        "----",
        `NAME: ${file.name}`,
        `MIME_TYPE: ${file.type || "application/pdf"}`,
        `CONTENT_BASE64: ${file.content}`,
      ].join("\n");
    })
    .join("\n");

  return `CHECKS TO PERFORM:\n${checksBlock}\n\nUPLOADED FILES:\n${filesBlock}\n----`;
};

const parseSSEChunk = (chunk: string): string => {
  if (!chunk.startsWith("data:")) return "";
  const data = chunk.replace(/^data:\s*/, "");
  if (!data || data === "[DONE]") {
    return data === "[DONE]" ? "__CLOSE__" : "";
  }

  try {
    const payload = JSON.parse(data);
    const delta = payload.choices?.[0]?.delta;
    if (!delta) return "";
    const content = delta.content;
    if (!content) return "";
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content
        .map((entry) => {
          if (typeof entry === "string") return entry;
          if (entry?.type === "text" && typeof entry.text === "string") {
            return entry.text;
          }
          return "";
        })
        .join("");
    }
    if (content?.type === "text" && typeof content.text === "string") {
      return content.text;
    }
    return "";
  } catch {
    return "";
  }
};

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY missing" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { files?: IncomingFile[]; checks?: IncomingCheck[] };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { files, checks } = body;
  if (!Array.isArray(files) || !Array.isArray(checks) || !files.length) {
    return new Response(JSON.stringify({ error: "Files and checks are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userMessage = buildUserMessage(checks, files);

  const openAIResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-5-mini",
      stream: true,
      temperature: 1,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!openAIResponse.ok || !openAIResponse.body) {
    const errorText = await openAIResponse.text();
    return new Response(JSON.stringify({ error: errorText || "OpenAI request failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const decoder = new TextDecoder("utf-8");
      const reader = openAIResponse.body!.getReader();
      let buffer = "";

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            if (buffer.trim()) {
              const text = parseSSEChunk(buffer.trim());
              if (text === "__CLOSE__") {
                controller.close();
                return;
              }
              if (text) {
                controller.enqueue(encoder.encode(text));
              }
            }
            controller.close();
            break;
          }

          buffer += decoder.decode(value, { stream: true });

          let boundary = buffer.indexOf("\n\n");
          while (boundary !== -1) {
            const chunk = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);

            const text = parseSSEChunk(chunk.trim());
            if (text === "__CLOSE__") {
              controller.close();
              return;
            }

            if (text) {
              controller.enqueue(encoder.encode(text));
            }

            boundary = buffer.indexOf("\n\n");
          }
        }
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
