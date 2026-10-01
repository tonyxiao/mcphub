import { ServerDaoImpl } from '../../src/dao/ServerDao.js';

describe('ServerDaoImpl', () => {
  it('timestamps new servers and preserves creation time through edits and duplication', async () => {
    const dao = new ServerDaoImpl();
    let stored: any[] = [];
    jest.spyOn(dao as any, 'getAll').mockImplementation(async () => stored);
    jest.spyOn(dao as any, 'saveAll').mockImplementation(async (servers: unknown) => {
      stored = servers as any[];
    });
    const created = await dao.create({ name: 'original', createdAt: '2000-01-01T00:00:00Z' });
    expect(Date.parse(created.createdAt!)).toBeGreaterThan(Date.parse('2000-01-01T00:00:00Z'));
    const updated = await dao.update('original', { description: 'Updated', createdAt: undefined });
    expect(updated?.createdAt).toBe(created.createdAt);
    const duplicate = await dao.create({
      ...created,
      name: 'duplicate',
      createdAt: '2000-01-01T00:00:00Z',
    });
    expect(duplicate.createdAt).not.toBe('2000-01-01T00:00:00Z');
  });

  it('includes explicitly shared group servers in paginated user results', async () => {
    const dao = new ServerDaoImpl();
    jest.spyOn(dao as any, 'getAll').mockResolvedValue([
      { name: 'owned', owner: 'alice', visibility: 'private' },
      { name: 'public', owner: 'bob', visibility: 'public' },
      {
        name: 'shared',
        owner: 'bob',
        visibility: 'group',
        sharedWithUsers: ['alice'],
      },
      {
        name: 'unshared',
        owner: 'bob',
        visibility: 'group',
        sharedWithUsers: ['charlie'],
      },
    ]);

    const result = await dao.findVisibleToUserPaginated('alice', 1, 10);

    expect(result.data.map((server) => server.name)).toEqual(['owned', 'public', 'shared']);
    expect(result.total).toBe(3);
  });

  it('unpacks startOnDemand/idleTimeoutMs mirrored into options and strips them from the stored options blob', async () => {
    // JSON-mode storage keeps configs verbatim, so without this the mirrored
    // keys added for database-mode persistence would leak into API responses
    // and the on-disk mcp_settings.json as user-visible noise, even though
    // JSON mode never needed the mirror in the first place.
    const dao = new ServerDaoImpl();
    jest.spyOn(dao as any, 'loadSettings').mockResolvedValue({
      mcpServers: {
        'on-demand-server': {
          type: 'stdio',
          command: 'npx',
          args: ['-y', 'demo-server'],
          enabled: true,
          options: {
            timeout: 5000,
            startOnDemand: true,
            idleTimeoutMs: 120000,
          },
        },
      },
    });

    const servers = await (dao as any).getAll();
    const server = servers.find((s: any) => s.name === 'on-demand-server');

    expect(server.startOnDemand).toBe(true);
    expect(server.idleTimeoutMs).toBe(120000);
    expect(server.options).toEqual({ timeout: 5000 });
  });
});
