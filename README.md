# FunctionBridge: Let LLMs call your frontend functions

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

**A programmable client-side execution environment for Large Language Models.**

## Overview

FunctionBridge easily lets you expose frontend functions and types for LLMs and
agent frameworks. Instead of individual tool calls, the functions are available
for the model to orchestrate in generated JavaScript code that runs securely in
the browser.

FunctionBridge builds on the
[Model Context Protocol](https://modelcontextprotocol.io/) and exposes exactly
one tool: `execute_javascript_code`. It uses
[FrontendMCP](https://github.com/failip/frontendmcp) to make that tool available
as a globally accessible MCP server using its proxy relay.

FunctionBridge was designed as a client-side implementation of the code
execution pattern described by Cloudflare's
[Code Mode](https://blog.cloudflare.com/code-mode/) and Anthropic's
[Code Execution](https://www.anthropic.com/engineering/code-execution-with-mcp):
keep the interface small, move orchestration into code, and keep intermediate
data local.

## Installation

```bash
npm install functionbridge zod
```

## Usage

```typescript
import { FunctionBridge } from "functionbridge";
import { z } from "zod/v4";

const bridge = new FunctionBridge();

// Define types the model can reference in generated code
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

// Register functions the model can call
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

A client connected to this URL sees a single tool: `execute_javascript_code`.
Rather than issuing separate tool calls for multiple steps, the model generates
one Javascript program that handles orchestration locally, returning only the
final required result.

## Architecture

FunctionBridge uses a hidden, cross-origin `iframe` with a restrictive Content
Security Policy to isolate LLM-generated code from your application.
Communication between the sandbox and the main thread is handled through
[Comlink](https://github.com/GoogleChromeLabs/comlink).

1. **Registration.** Your application registers functions and type definitions.
2. **Sandboxed execution.** Generated code runs inside the isolated iframe
   without access to the main thread's scope, DOM, or global objects.
3. **RPC bridge.** Comlink proxies function calls from the sandbox to the
   explicitly registered implementations on the main thread.
4. **Result return.** The final return value is sent back to the model through
   MCP.

## Use Cases

- **Fewer round trips:** Multi-step workflows execute in a single turn.
- **Data privacy and token efficiency:** Large datasets are filtered locally
  before any result returns to the model.
- **Natural language interfaces** for interacting with complex frontend data.
- **Browser-only resource access**, exposing IndexedDB, in-memory state, or
  authenticated API clients to LLMs.

## Constraints & Limitations

- Execution happens inside a sandboxed, cross-origin iframe. Only explicitly
  registered functions are accessible.
- No direct DOM manipulation or network access from within the sandbox.
- Only serializable data can cross the Comlink bridge (no methods or circular
  references).
- Execution may encounter token limits or timeouts for very large scripts.

## Roadmap

- Web Worker implementation
- Automated documentation generation extracting function signatures from
  TypeScript/JSDoc
- Large data handling strategies for avoiding copying across the Comlink bridge
- Community feedback and contributions to guide future development

## Contributing

Issues and pull requests are welcome on GitHub.
