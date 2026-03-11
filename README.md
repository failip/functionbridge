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

### A programmable client-side execution environment for Large Language Models.

## Overview

Instead of defining tools you define types and functions to expose to your llm.

the llm writes code that calls those functions

easier than tool calling, directly in the frontend, less round trips, more
powerful, can use existing frontend code and resources

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

Code execution usually runs in the backend, this is "expensive" in terms of
compute cost, latency, and data transfer. instead of using your backend as an
execution environment, you can use the clients browser, scaling for free, with
access to local data and resources, and a direct connection to the user.

Frontend only development workflow is way faster, you can iterate on your
functions and types without needing to redeploy a backend, and you can reuse
existing frontend code and resources like authenticated API clients, in-memory
state, IndexedDB, and UI logic.

Builds on top of the MCP protocol, so it works with any LLM or agent framework
that supports MCP tools. Only one tool is exposed: `execute_javascript_code`.

Builds on top of [FrontendMCP](https://github.com/failip/frontendmcp) so you
instantely get a globally accessible FrontendMCP server with no additional
setup.

[Model Context Protocol (MCP)](https://modelcontextprotocol.io/)

## Installation

```bash
npm install functionbridge zod
```

## Example

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

## Architecture

FunctionBridge uses a hidden, cross-origin `iframe` with a restrictive Content
Security Policy to execute LLM-generated as isolated as possible. The main
application registers functions in that sandbox using `addFunction(...)`, and
the model can call those functions from its generated code. The bridge uses
Comlink to facilitate communication between the sandbox and the main thread,
ensuring that only registered functions are accessible. The entire execution
environment is exposed as a single MCP tool, allowing LLMs to orchestrate
complex workflows in the browser with minimal round trips. The MCP server is
built upon FrontendMCP, so it can be easily integrated into existing
applications without additional backend setup.

FunctionBridge builds on [FrontendMCP](https://github.com/failip/frontendmcp)
and [Comlink](https://github.com/GoogleChromeLabs/comlink).

1. **Sandboxed execution**: LLM-generated code runs in a hidden, cross-origin
   `iframe` with a restrictive Content Security Policy.
2. **Registered function access**: only functions explicitly registered through
   `addFunction(...)` are exposed. The model does not gain arbitrary access to
   your application.
3. **RPC bridge**: Comlink calls registered functions on the main thread from
   inside the sandbox.
4. **MCP relay**: FrontendMCP exposes the browser-resident server to external
   MCP clients through a standard endpoint.

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

## Use cases

- Natual language interfaces for frontend applications, allowing users to
  interact with complex data and functionality through conversational queries.
- Agents that can perform multi-step workflows in the browser, such as data
  analysis, report generation, or UI manipulation.
- Extending LLM capabilities with access to browser-only resources like
  IndexedDB, in-memory state, or authenticated API clients.

## Limitations

- Only serializable data can be passed over the Comlink bridge, complex objects
  with methods or circular references are not supported.
- Larger code executions may hit token limits or timeouts depending on the LLM
  and MCP client configuration.

## Execution constraints

- Code runs in an isolated sandbox.
- Access is limited to registered functions only.
- No access to the main thread's scope, DOM, or global objects unless explicitly
  exposed through registered functions.
- Network access completely restricted by sandbox policy.

## Goals

- Easiest way for developers to expose application functionality to LLMs.
- Be as token- and latency-efficient as possible.
- Secure by default with strong isolation and explicit function registration.
- Framework-agnostic and easy to integrate into existing applications.

## Contributing

Issues and pull requests are welcome on GitHub.
