import { FrontendMCPServer } from 'frontendmcp';
import * as Comlink from 'comlink';
import { z } from 'zod/v4';

export class FunctionBridgeWorker {
	private functions: Record<string, (...args: any[]) => any> = {};
	private port: MessagePort | null = null;
	private uuid: string | null = null;
	private authorizationToken: string | null = null;
	private mcpServer: FrontendMCPServer | null = null;

	constructor() {
		window.addEventListener('message', this.handleMessage.bind(this));
		window.parent.postMessage('ready', '*');
	}

	private handleMessage(event: MessageEvent) {
		const data = event.data;
		if (data && data.type === 'init' && event.ports.length > 0) {
			this.uuid = data.uuid;
			this.authorizationToken = data.authorizationToken;
			if (!this.uuid || !this.authorizationToken) {
				console.error('Initialization message missing uuid or authorizationToken');
				return;
			}
			this.port = event.ports[0];
			const remoteHost: any = Comlink.wrap(this.port);
			remoteHost.subscribe(
				Comlink.proxy((name: string) => {
					this.functions[name] = async (...args: any[]) => {
						return await remoteHost.runFunction(name, args);
					};
				})
			);

			const mcpServer = new FrontendMCPServer({
				version: '1.0.0',
				name: 'FunctionBridge MCP Server',
				frontendMCP: {
					uuid: this.uuid,
					authorizationToken: this.authorizationToken
				}
			});

			this.mcpServer = mcpServer;

			this.mcpServer.registerTool(
				'execute_typescript_code',
				{
					title: 'Execute Typescript Code',
					description:
						'Errors if the code is invalid or fails to execute. Returns the result of the code execution.',
					inputSchema: z.object({
						code: z.string().describe('The typescript code to execute.')
					})
				},
				async (args: any) => {
					const logs: string[] = [];
					const originalLog = console.log;
					console.log = (...args: any[]) => {
						logs.push(
							args
								.map((arg) => {
									try {
										return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
									} catch {
										return String(arg);
									}
								})
								.join(' ')
						);
						originalLog.apply(console, args);
					};

					try {
						// Dynamically create and execute an asynchronous function from the provided code string.
						// We extract the names and references of all registered functions (this.functions)
						// and pass them as arguments to the new AsyncFunction. This effectively injects
						// the registered functions into the local scope of the executed code, allowing
						// the agent's script to call them directly by name.
						const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
						const funcNames = Object.keys(this.functions);
						const funcRefs = Object.values(this.functions);

						const execute = new AsyncFunction(...funcNames, args.code);
						let result = await execute(...funcRefs);

						result = result === undefined ? '' : result;

						const resultText = typeof result === 'string' ? result : JSON.stringify(result);
						const logsText = logs.length > 0 ? '\n' + logs.join('\n') : '';
						const combinedResult =
							resultText + logsText || 'Code executed successfully with no output.';

						return {
							content: [
								{
									type: 'text' as const,
									text: combinedResult
								}
							],
							isError: false
						};
					} catch (e: any) {
						const logsText = logs.length > 0 ? '\n' + logs.join('\n') : '';
						return {
							content: [
								{
									type: 'text' as const,
									text: `Error: ${e.message}${logsText}`
								}
							],
							isError: true
						};
					} finally {
						console.log = originalLog;
					}
				}
			);

			this.mcpServer.connect();
		}
	}
}
