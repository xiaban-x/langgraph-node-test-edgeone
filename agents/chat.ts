/**
 * Minimal LangGraph chat agent.
 *
 * Mirrors the structure of langgraph-quiz-starter (which works in production):
 * - Flat `agents/chat.ts` file (NOT `agents/chat/index.ts` directory)
 * - Vite SPA build, not Next.js
 * - LangChain v1.x packages
 * - Reads context.env / context.conversation_id from runtime
 *
 * POST /chat
 * Body: { message: string }
 * Returns: SSE stream of { type, ... }
 */
import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";

// ─── State ───
const State = Annotation.Root({
  userInput: Annotation<string>({ reducer: (_, n) => n, default: () => "" }),
  reply: Annotation<string>({ reducer: (_, n) => n, default: () => "" }),
});
type StateType = typeof State.State;

interface Env {
  AI_GATEWAY_API_KEY: string;
  AI_GATEWAY_BASE_URL: string;
  AI_MODEL?: string;
}

function getEnv(contextEnv: Record<string, string | undefined> | undefined): Env {
  const source = contextEnv ?? {};
  const required = ["AI_GATEWAY_API_KEY", "AI_GATEWAY_BASE_URL"] as const;
  const missing = required.filter((k) => !source[k]?.trim());
  if (missing.length) throw new Error(`Missing env vars: ${missing.join(", ")}`);
  return {
    AI_GATEWAY_API_KEY: source.AI_GATEWAY_API_KEY!,
    AI_GATEWAY_BASE_URL: source.AI_GATEWAY_BASE_URL!,
    AI_MODEL: source.AI_MODEL,
  };
}

function buildGraph(env: Env) {
  const model = new ChatOpenAI({
    model: env.AI_MODEL || "@makers/deepseek-v4-flash",
    apiKey: env.AI_GATEWAY_API_KEY,
    configuration: { baseURL: env.AI_GATEWAY_BASE_URL },
    timeout: 60_000,
  });

  return new StateGraph(State)
    .addNode("answer", async (state: StateType) => {
      const response = await model.invoke([
        new SystemMessage("Reply in 1 short sentence."),
        new HumanMessage(state.userInput),
      ]);
      const reply =
        typeof response.content === "string"
          ? response.content
          : JSON.stringify(response.content);
      return { reply };
    })
    .addEdge(START, "answer")
    .addEdge("answer", END)
    .compile();
}

function sse(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function onRequest(context: any) {
  const { request, env } = context;
  const body = request?.body ?? {};
  const message = typeof body.message === "string" ? body.message.trim() : "";

  let agentEnv: Env;
  try {
    agentEnv = getEnv(env);
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!message) {
    return new Response(JSON.stringify({ error: "Missing message" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(sse({ type: "step", step: "build_graph" })));
        const graph = buildGraph(agentEnv);

        controller.enqueue(encoder.encode(sse({ type: "step", step: "stream" })));
        const graphStream = await graph.stream({ userInput: message });

        for await (const event of graphStream) {
          for (const [nodeName, output] of Object.entries(event)) {
            const out = output as Partial<StateType>;
            controller.enqueue(encoder.encode(sse({ type: "step", step: nodeName })));
            if (out.reply) {
              controller.enqueue(encoder.encode(sse({ type: "reply", content: out.reply })));
            }
          }
        }

        controller.enqueue(encoder.encode(sse({ type: "done" })));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (e) {
        controller.enqueue(
          encoder.encode(sse({ type: "error", error: (e as Error).message }))
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
