import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';

export function selectAccount(value, accounts, defaultAccount) {
  const email = value === undefined ? defaultAccount : value;
  if (typeof email !== 'string' || !accounts.includes(email)) {
    throw new Error(`Unsupported acting_email. Choose one of: ${accounts.join(', ')}`);
  }
  return email;
}

export function accountArguments(input, accounts, defaultAccount) {
  const { acting_email, acting_account, ...args } = input ?? {};
  if (acting_email !== undefined && acting_account !== undefined && acting_email !== acting_account) throw new Error('Conflicting account selectors');
  return { email: selectAccount(acting_email !== undefined ? acting_email : acting_account, accounts, defaultAccount), args };
}

export function accountTool(tool, accounts, defaultAccount) {
  return {
    ...tool,
    description: `Accounts: ${accounts.join(', ')}. Use acting_email; default: ${defaultAccount}. ${tool.description ?? ''}`,
    inputSchema: {
      ...tool.inputSchema,
      properties: {
        ...tool.inputSchema.properties,
        acting_email: { type: 'string', enum: accounts, description: `Google account email. Defaults to ${defaultAccount}.` },
      },
    },
  };
}

export async function main() {
  const sdk = join(process.env.MCPHUB_MODULE_ROOT ?? fileURLToPath(new URL('../', import.meta.url)), 'node_modules/@modelcontextprotocol/sdk/dist/esm');
  const load = path => import(pathToFileURL(join(sdk, path)).href);
  const [{ Server }, { StdioServerTransport }, { Client }, { StdioClientTransport }, types] = await Promise.all([
    load('server/index.js'), load('server/stdio.js'), load('client/index.js'), load('client/stdio.js'), load('types.js'),
  ]);
  const gog = process.env.GOG_BINARY ?? 'gog';
  const records = JSON.parse(execFileSync(gog, ['auth', 'list', '--json', '--no-input'], { encoding: 'utf8' })).accounts;
  // Only advertise accounts whose stored credentials can actually be read.
  const accounts = records.filter(a => !a.error).map(a => a.email);
  const defaultAccount = selectAccount(process.env.GOG_DEFAULT_ACCOUNT ?? accounts[0], accounts);
  const clients = new Map();
  const clientFor = email => {
    if (!clients.has(email)) {
      const pending = (async () => {
        const client = new Client({ name: 'gog-multi-account', version: '1' });
        try {
          await client.connect(new StdioClientTransport({ command: gog, args: ['mcp', `--account=${email}`, '--allow-write', '--gmail-no-send', '--wrap-untrusted', '--no-input'], env: Object.fromEntries(Object.entries(process.env).filter(([,v]) => v !== undefined)), stderr: 'inherit' }));
          return client;
        } catch (error) { await client.close(); throw error; }
      })();
      clients.set(email, pending);
      pending.catch(() => { if (clients.get(email) === pending) clients.delete(email); });
    }
    return clients.get(email);
  };
  const upstreamTools = (await (await clientFor(defaultAccount)).listTools()).tools;
  const names = new Set(upstreamTools.map(t => t.name));
  const server = new Server({ name: 'gog', version: '1' }, { capabilities: { tools: {} }, instructions: `Supported accounts: ${accounts.join(', ')}. Select acting_email on each call. Default: ${defaultAccount}. Gmail sending is disabled.` });
  server.setRequestHandler(types.ListToolsRequestSchema, async () => ({ tools: [
    { name: 'list_accounts', description: `Supported Google accounts: ${accounts.join(', ')}. Lists accounts and the default acting account.`, inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
    ...upstreamTools.map(t => accountTool(t, accounts, defaultAccount)),
  ] }));
  server.setRequestHandler(types.CallToolRequestSchema, async request => {
    if (request.params.name === 'list_accounts') return { content: [{ type: 'text', text: JSON.stringify({ accounts: records.filter(a => !a.error).map(({ email, services }) => ({ email, services })), default_acting_email: defaultAccount, default_account: defaultAccount }) }] };
    if (!names.has(request.params.name)) throw new Error('Unknown GOG tool');
    const { email, args } = accountArguments(request.params.arguments, accounts, defaultAccount);
    const client = await clientFor(email);
    return client.callTool({ name: request.params.name, arguments: args });
  });
  const close = async () => { await server.close(); await Promise.allSettled([...clients.values()].map(async p => (await p).close())); };
  process.once('SIGTERM', () => { void close().finally(() => process.exit(0)); });
  process.once('SIGINT', () => { void close().finally(() => process.exit(0)); });
  process.stdin.once('end', () => { void close(); });
  await server.connect(new StdioServerTransport());
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error('GOG MCP startup failed; check credential access and supported accounts.'); process.exitCode = 1; });
}
