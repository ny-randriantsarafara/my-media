import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { testEnvironment } from './environment.ts';

export type ToolOutcome = { isError: boolean; text: string };

const toolCallResponse = z.object({
  result: z.object({
    isError: z.boolean().optional(),
    content: z.array(z.object({ type: z.string(), text: z.string().optional() })),
  }),
});
const toolListResponse = z.object({ result: z.object({ tools: z.array(z.object({ name: z.string() })) }) });
const toolErrors = z.array(z.object({ error: z.string(), code: z.string().optional() }));

async function postMcp(token: string, method: string, params: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(`${testEnvironment.directusUrl}/mcp`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: randomUUID(), method, params }),
  });
  if (!response.ok) {
    throw new Error(`MCP returned HTTP ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

export async function listMcpTools(token: string): Promise<string[]> {
  const parsed = toolListResponse.parse(await postMcp(token, 'tools/list', {}));
  return parsed.result.tools.map((tool) => tool.name);
}

export async function callMcpTool(token: string, name: string, args: Record<string, unknown>): Promise<ToolOutcome> {
  const parsed = toolCallResponse.parse(await postMcp(token, 'tools/call', { name, arguments: args }));
  return {
    isError: parsed.result.isError ?? false,
    text: parsed.result.content.map((part) => part.text ?? '').join('\n'),
  };
}

export function readToolErrorCodes(outcome: ToolOutcome): string[] {
  const parsed: unknown = JSON.parse(outcome.text);
  return toolErrors
    .parse(parsed)
    .map((error) => error.code)
    .filter((code) => code !== undefined);
}
