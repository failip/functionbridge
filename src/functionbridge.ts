import * as Comlink from 'comlink';
import { z } from 'zod';

type FunctionBridgeSettings = {
	frontendMCPServerUrl?: string;
	functionBridgeWorkerUrl?: string;
};

export class FunctionBridge {
	public readonly mcpServerUrl: string;
	public readonly authorizationToken: string;
	private uuid: string;
	private iframe: HTMLIFrameElement;
	private channel: MessageChannel;
	private functions: Map<string, { func: (...args: any[]) => any; schema?: z.ZodTypeAny }> =
		new Map();
	private functionDocs: Map<string, string> = new Map();
	private typeDefinitions: string[] = [];
	private subscribers: ((name: string) => void)[] = [];

	constructor(settings?: FunctionBridgeSettings) {
		this.uuid = crypto.randomUUID();
		this.authorizationToken = crypto.randomUUID();

		// Sandboxed iframe
		this.iframe = document.createElement('iframe');
		this.iframe.sandbox.add('allow-scripts');
		this.iframe.allow = "camera 'none'; microphone 'none'; geolocation 'none'";
		this.iframe.referrerPolicy = 'no-referrer';

		this.iframe.src = settings?.functionBridgeWorkerUrl ?? 'https://functionbridge.com/worker';
		if (new URL(this.iframe.src).origin === window.location.origin) {
			console.warn('FunctionBridge worker must be served from a different origin.');
		}
		this.iframe.style.display = 'none';
		this.mcpServerUrl = `${settings?.frontendMCPServerUrl ?? 'https://mcp.frontendmcp.com/mcp'}/${this.uuid}`;

		this.channel = new MessageChannel();

		const api = {
			runFunction: async (name: string, args: any[]) => {
				const target = this.functions.get(name);
				if (!target) {
					throw new Error(`Function ${name} not found`);
				}

				if (target.schema) {
					console.log(`Validating arguments for function ${name} with schema:`, target.schema);
					const parsed = await target.schema.parseAsync(args.length === 1 ? args[0] : args);
					return await target.func(parsed);
				}

				return await target.func(...args);
			},
			subscribe: (callback: (name: string) => void) => {
				this.subscribers.push(callback);
				for (const name of this.functions.keys()) {
					callback(name);
				}
			}
		};

		const onMessage = (event: MessageEvent) => {
			if (event.source === this.iframe.contentWindow && event.data === 'ready') {
				this.iframe.contentWindow?.postMessage(
					{ type: 'init', uuid: this.uuid, authorizationToken: this.authorizationToken },
					'*',
					[this.channel.port2]
				);
				window.removeEventListener('message', onMessage);
				Comlink.expose(api, this.channel.port1);
			}
		};
		window.addEventListener('message', onMessage);

		document.body.appendChild(this.iframe);
	}

	public addFunction<T extends z.ZodTypeAny = z.ZodTypeAny>(
		name: string,
		func: (args?: any, ...rest: any[]) => any,
		jsDocumentation?: string,
		schema?: T
	): void {
		console.log(`Registering function: ${name} `);

		this.functions.set(name, { func, schema });
		if (jsDocumentation) {
			this.functionDocs.set(name, jsDocumentation);
		}

		this.subscribers.forEach((callback) => callback(name));
	}

	public removeFunction(name: string): void {
		this.functions.delete(name);
		this.functionDocs.delete(name);
	}

	public addTypeDefinition(typeDef: string): void {
		this.typeDefinitions.push(typeDef);
	}

	public availableFunctions(): string {
		return Array.from(this.functions.keys())
			.map((name) => `${name}`)
			.join(', ');
	}

	public functionDocumentation(): string {
		let docs =
			'In the Javascript execution environment, you have access to the following functions:\n\n';
		this.typeDefinitions.forEach((typeDef) => {
			docs += `${typeDef}\n\n`;
		});
		this.functionDocs.forEach((doc, name) => {
			docs += `${doc ?? `async ${name}()`}\n\n`;
		});
		return docs;
	}
}
