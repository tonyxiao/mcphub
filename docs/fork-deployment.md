# Tony's MCPHub fork

The host runs builds from `https://github.com/tonyxiao/mcphub`, committed directly
on `main`. No upstream PR is required for this deployment.

Validate with `pnpm lint`, `pnpm test:ci --runInBand`, `pnpm build`,
`node --test scripts/test-gog-mcp.mjs`, and `node scripts/verify-dist.js`.
Commit and push `main`, then run `node scripts/deploy-local.mjs` on CS Mini.
The script installs a revision-specific build under
`~/.local/share/mcphub/releases/<commit>` and switches the existing package path
at `~/.local/lib/node_modules/@samanhappy/mcphub` to it. `deployment.json` records
its source revision and previous installation. Restart only the MCPHub LaunchAgent
with `launchctl kickstart -k gui/$(id -u)/ai.mcphub.gateway`.

Releases reuse the checkout's frozen-lockfile dependency tree. Keep that checkout
and its `node_modules` available while the release is active. Deployment is local;
this script does not publish an npm package.

Host settings, OAuth state, bearer keys, and account descriptions remain in
`~/.mcphub/mcp_settings.json`; none are copied into the fork or release. Existing
loopback binding and machine-secret injection remain owned by host infrastructure.
OAuth refresh recovery and server-note Markdown are implemented in source, so
compiled-asset overlays and OAuth monkey patches are no longer needed.

The optional `scripts/gog-mcp.mjs` adapter exposes GOG's supported tools with an
`acting_email` parameter (with `acting_account` accepted as a compatibility alias) and `list_accounts`. Set `GOG_DEFAULT_ACCOUNT` in the
private server environment to choose the default, and provide GOG's credential
backend environment as usual. Each account has its own child process. The adapter
preserves the existing Gmail no-send and explicit-write controls.

The server list defaults to oldest creation first, with disabled servers last.
The dashboard can also sort newest first or by name in either direction; the
choice is saved per browser. New servers have a persistent creation timestamp.
Legacy JSON entries without timestamps use their stored order (reversed for
newest first); reconnecting does not change that order. Page sizes are 25, 50,
100, and 200, defaulting to 25 when an older saved size is unsupported.
