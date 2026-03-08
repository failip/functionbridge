# FunctionBridge

<div align="center">
<picture>
<img src="./docs/assets/functionbridge-wordmark.svg" alt="FunctionBridge Logo" width="500"/>
</picture>
<div align="left">
<a href="https://www.npmjs.com/package/functionbridge">
<img src="https://img.shields.io/npm/v/functionbridge" alt="npm version" />
</a>
</div>
</div>

## Overview

FunctionBridge enables LLMs to execute TypeScript and JavaScript in a secure
browser sandbox and interact with frontend functionality through explicitly
registered functions.

Instead of registering many narrowly scoped tools, you expose a compact,
programmable execution environment. The model writes code that coordinates your
frontend functions, transforms intermediate data locally, and returns only the
final result.

This follows the code execution pattern described by Cloudflare's
[Code Mode](https://blog.cloudflare.com/code-mode/) and Anthropic's
[Code Execution](https://www.anthropic.com/engineering/code-execution-with-mcp):
keep the interface small, move orchestration into code, and keep intermediate
data local.

## Installation

```bash
npm install functionbridge zod
```

## Requirements

- **Environment:** Modern browsers
- **Frameworks:** React, Vue, Svelte, or Vanilla JS

## How it works

1. Your application registers frontend functions.
2. FunctionBridge exposes a single MCP tool: `execute_typescript_code`.
3. An LLM connects through MCP and sends TypeScript or JavaScript to execute.
4. That code runs in a sandboxed browser context with access only to the
   functions you registered.
5. Function results and console output are returned as a single tool response.

## Usage

```typescript
import { FunctionBridge } from "functionbridge";
import { z } from "zod/v4";

const bridge = new FunctionBridge();

bridge.addTypeDefinition(`
type Transaction = {
  id: string;
  date: string;
  amount: number;
  category: string;
};
`);

bridge.addTypeDefinition(`
type ChartConfig = {
  type: "bar" | "line" | "pie";
  data: any;
};
`);

bridge.addFunction(
  "getAllTransactions",
  () => db.transactions.toArray(),
  "getAllTransactions(): Promise<Transaction[]>",
  z.object({}),
);

bridge.addFunction(
  "showChart",
  (config: ChartConfig) => renderChart(config),
  "showChart(config: ChartConfig): void",
  z.object({ config: z.any() }),
);

bridge.addFunction(
  "notifyUser",
  (message: string) => toast(message),
  "notifyUser(message: string): void",
  z.object({ message: z.string() }),
);

// Pass this URL to your backend LLM or MCP client
const url = bridge.mcpServerUrl;
```

A client connected to this URL sees one tool: `execute_typescript_code`.

Example request:

> Where did I spend the most money last month? Show me a chart.

Instead of calling each function as a separate tool call, it expresses the
entire workflow in one program:

```typescript
const transactions = await getAllTransactions();

const now = new Date();
const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
const end = new Date(now.getFullYear(), now.getMonth(), 0);

const filtered = transactions.filter((t) => {
  const d = new Date(t.date);
  return d >= start && d <= end;
});

const totals = {};
for (const t of filtered) {
  totals[t.category] ??= 0;
  totals[t.category] += t.amount;
}

const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);

await showChart({
  type: "bar",
  data: sorted.map(([category, amount]) => ({ category, amount })),
});

return `Your highest spending category last month was ${sorted[0][0]}.`;
```

Filtering, aggregation, and rendering all happen inside the browser. Only the
final result returns to the model.

## Advantages

| Feature                 | Traditional Tool Calling | FunctionBridge       |
| ----------------------- | ------------------------ | -------------------- |
| **Round trips**         | One per function call    | Single execution     |
| **Intermediate data**   | Returned at each step    | Stays in the browser |
| **Branching and loops** | Managed across turns     | Written in code      |
| **Tool surface**        | One schema per operation | One execution tool   |

- **Fewer round trips**: complex workflows become a single generated program
  rather than many sequential tool calls.
- **Data stays local**: large datasets are filtered and transformed before any
  result is returned to the model.
- **Reuses existing frontend code**: including authenticated API clients, so
  teams avoid duplicating the same logic in backend services.
- **Works against browser-only resources**: in-memory state, IndexedDB, UI
  logic, and session-scoped API clients already available in the application.

## Architecture

FunctionBridge builds on [FrontendMCP](https://github.com/failip/frontendmcp)
and isolates execution from the host application:

1. **Sandboxed execution**: LLM-generated code runs in a hidden, cross-origin
   `iframe` with a restrictive Content Security Policy.
2. **Registered function access**: only functions explicitly registered through
   `addFunction(...)` are exposed. The model does not gain arbitrary access to
   your application.
3. **RPC bridge**: Comlink calls registered functions on the main thread from
   inside the sandbox.
4. **MCP relay**: FrontendMCP exposes the browser-resident server to external
   MCP clients through a standard endpoint.

## Use cases

- **Local data analysis**: query IndexedDB, local caches, or browser-managed
  data.
- **UI orchestration**: trigger state reads, updates, and UI actions in one
  script.
- **Authenticated backend operations**: call frontend functions that already use
  the current user's session.
- **Natural language to action**: translate requests into client-side workflows.
- **Privacy-sensitive workflows**: keep intermediate values in the browser.

## Execution constraints

- Code runs in an isolated sandbox.
- Access is limited to registered functions only.
- No arbitrary DOM access.
- Network access can be restricted by sandbox policy.
- Inputs can be validated with `zod` schemas on registered functions.

## Contributing

Issues and pull requests are welcome on GitHub.
