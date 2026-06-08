# LangGraph Minimal Test Template

Vite + LangGraph minimal test, mirroring `langgraph-quiz-starter-node-pre01` structure.

## Structure (same as quiz-starter)

```
agents/chat.ts          # flat .ts file (NOT directory!)
src/{App,main}.tsx      # SPA
index.html              # Vite entry
edgeone.json            # outputDirectory: dist, no `framework` key
package.json            # langchain v1.x
vite.config.ts
```

## Why differs from earlier (404'd) attempt

| Variable | First attempt (404) | This version |
|----------|--------------------|--------------|
| Build framework | Next.js | **Vite** |
| Agent file | `agents/chat/index.ts` directory | **`agents/chat.ts` flat** |
| Output dir | `.next` | **`dist`** |
| `framework` key | `"nextjs"` | **omitted** |
| `externalNodeModules` | populated | **`[]` empty** |
| LangChain | 0.x | **1.x** |

This version exactly clones the working `langgraph-quiz-starter` shape, only stripped down to one node + one POST endpoint. If this works, we know any of those 6 dimensions might be the cause and can bisect.

## Test plan

1. `npm install`
2. Set env (AI_GATEWAY_API_KEY / AI_GATEWAY_BASE_URL)
3. Deploy
4. Click "POST /chat" — expect SSE stream `{type:"step"}`, `{type:"reply", content:"..."}`, `{type:"done"}`
