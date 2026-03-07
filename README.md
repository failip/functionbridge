# FunctionBridge

<p align="center">
  <picture>
    <img src="./docs/assets/functionbridge-wordmark.svg" alt="FunctionBridge Logo" width="500"/>
  </picture>
</p>

![npm](https://img.shields.io/npm/v/functionbridge)

## Overview

FunctionBridge enables LLMs to execute TypeScript and JavaScript in a secure
browser sandbox and interact with frontend functionality through explicitly
registered functions.

It is designed for applications that want to expose rich client-side
capabilities to an LLM without building a custom backend orchestration layer.
Instead of registering many narrowly scoped tools, you expose a compact,
programmable execution environment. The model writes code that coordinates your
frontend functions, transforms intermediate data locally, and returns only the
final result.

This approach aligns with the code execution patterns described by Cloudflare's
[Code Mode](https://blog.cloudflare.com/code-mode/) and Anthropic's
[Code Execution](https://www.anthropic.com/engineering/code-execution-with-mcp):
move orchestration into code, keep tool surfaces small, and reduce unnecessary
token usage.

## Installation

```bash
npm install functionbridge
```

## How it works

FunctionBridge creates an MCP endpoint backed by a browser-hosted execution
environment:

1. Your application registers frontend functions.
2. FunctionBridge exposes a single MCP tool: `execute_typescript_code`.
3. An LLM connects through MCP and sends TypeScript or JavaScript to execute.
4. That code runs in a sandboxed browser context with access only to the
   functions you registered.
5. Function results and console output are returned as a single tool response.

This lets the model perform filtering, mapping, aggregation, branching, and
multi-step orchestration locally in the browser instead of across multiple tool
calls.

## Usage

```typescript
import { FunctionBridge } from "functionbridge";
import { z } from "zod";

// 1. Create the bridge
const bridge = new FunctionBridge();

// 2. Register frontend capabilities
bridge.addFunction(
  "getUserData",
  async () => {
    // Access local state, IndexedDB, application stores, etc.
    return { id: 1, name: "Alice", role: "admin" };
  },
  "/** Returns the current user record. */",
);

bridge.addFunction(
  "updateUIPanel",
  async ({ panelId, status }) => {
    document.getElementById(panelId).innerText = status;
    return { success: true };
  },
  "/** Updates a UI panel with a new status value. */",
  z.object({
    panelId: z.string(),
    status: z.string(),
  }),
);

// 3. Pass this URL to your backend LLM or MCP client
const url = bridge.mcpServerUrl;
```

An MCP client connected to this URL will see a single tool,
`execute_typescript_code`, and can run code such as:

```typescript
const user = await getUserData();

if (user.role === "admin") {
  await updateUIPanel({
    panelId: "admin-panel",
    status: "Active",
  });
}

return `Updated UI for ${user.name}`;
```

## What this enables

Because the model is writing code instead of chaining many individual tools, it
can:

- Combine multiple frontend functions in one execution
- Filter and transform large local datasets before returning a result
- Perform conditional logic and iteration without a multi-turn loop
- Keep intermediate client-side data inside the browser runtime
- Work against browser-only resources such as in-memory state, IndexedDB, UI
  logic, and authenticated API clients already available in the application

## Architecture

FunctionBridge builds on [FrontendMCP](https://github.com/failip/frontendmcp)
and isolates execution from the host application:

1. **Sandboxed execution** LLM-generated code runs in a hidden, cross-origin
   `iframe` with a restrictive Content Security Policy. This isolates execution
   from the main application context.

2. **Registered function access** Only functions explicitly registered through
   `addFunction(...)` are exposed to the execution environment. The model does
   not gain arbitrary access to your application.

3. **RPC bridge** `Comlink` is used to call registered functions on the main
   thread from inside the sandbox. This provides a controlled interface between
   execution and the host application.

4. **MCP relay** `FrontendMCP` exposes the browser-resident server to external
   MCP clients so backend agents can invoke the single execution tool through a
   standard MCP endpoint.

## Why this model works well

Traditional tool-calling often becomes inefficient as the number of frontend
capabilities grows:

- **Smaller tool surface** Instead of exposing many individual operations, you
  expose one execution tool backed by your own frontend API surface.

- **Lower token usage** Intermediate results can be processed inside the browser
  and do not need to be repeatedly serialized back into the model context.

- **Fewer round trips** Complex workflows can be expressed as one generated
  program instead of many sequential tool calls.

- **Simpler architecture** Orchestration remains in the client, reducing the
  need for custom backend agents or middleware to coordinate UI and local state
  operations.

- **Better developer experience** Existing frontend code can be reused directly,
  including authenticated API calls made on the user's behalf from the browser,
  so teams can implement new AI-driven workflows without duplicating the same
  logic in backend services.

## Typical use cases

- **Local data analysis** Query IndexedDB, local caches, or browser-managed data
  and return only the subset relevant to the user request.

- **UI orchestration** Trigger a sequence of frontend actions, state reads, and
  updates in a single generated script.

- **Authenticated backend operations** Call frontend functions that already wrap
  backend endpoints using the current user's session, cookies, or access token.
  This allows the LLM to perform user-scoped backend actions without requiring a
  separate orchestration layer to re-implement authentication and request logic.

- **Natural language to action pipelines** Convert user instructions into
  structured client-side workflows without building custom parsers for every
  command.

- **Privacy-sensitive workflows** Keep intermediate values inside the browser
  while returning only the final, necessary output to the model.

## Execution model and constraints

FunctionBridge is intended to provide controlled execution, not unrestricted
browser automation.

- Code runs in an isolated sandbox
- Access is limited to the functions you register
- The sandbox does not directly expose arbitrary DOM access
- Network access can be restricted by sandbox policy
- Input validation can be enforced with `zod` schemas on registered functions

This design gives you a narrow, auditable integration layer while still letting
the model express complex logic in code.

## Contributing

Issues and pull requests are welcome on GitHub.
