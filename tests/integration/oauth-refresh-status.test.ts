const mockFindById = jest.fn();
const mockUpdate = jest.fn();
const mockGetServer = jest.fn();
jest.mock('../../src/dao/index.js', () => ({
  getServerDao: () => ({ findById: mockFindById, update: mockUpdate }),
  getSystemConfigDao: () => ({ get: async () => ({}) }),
}));
jest.mock('../../src/services/mcpService.js', () => ({ getServerByName: mockGetServer }));

jest.mock('../../src/services/oauthClientRegistration.js', () => ({
  getRegisteredClient: jest.fn(),
  initializeOAuthForServer: jest.fn(),
  removeRegisteredClient: jest.fn(),
  fetchScopesFromServer: jest.fn(),
}));

import { MCPHubOAuthProvider } from '../../src/services/mcpOAuthProvider.js';

describe('OAuth refresh persistence and discovery status', () => {
  const config = {
    url: 'https://fixture.example/mcp',
    oauth: { accessToken: 'old', refreshToken: 'refresh' },
  };
  beforeEach(() => {
    jest.resetAllMocks();
    mockFindById.mockImplementation(async () => ({ name: 'fixture', ...config, oauth: { ...config.oauth } }));
    mockUpdate.mockImplementation(async (_name, update) => ({ name: 'fixture', ...update }));
  });
  it('persists refreshed credentials before restoring a live client to discovery', async () => {
    const server = {
      client: {},
      status: 'oauth_required',
      error: 'authorization required',
      oauth: { state: 'pending' },
    };
    mockGetServer.mockReturnValue(server);
    const provider = new MCPHubOAuthProvider('fixture', config);
    await provider.saveTokens({ access_token: 'new', token_type: 'Bearer' });
    expect(mockUpdate).toHaveBeenCalledWith('fixture', {
      oauth: expect.objectContaining({ accessToken: 'new', refreshToken: 'refresh' }),
    });
    expect(server).toMatchObject({ status: 'connected', error: null });
    expect(server.oauth).toBeUndefined();
    expect(provider.tokens()?.access_token).toBe('new');
  });
  it('does not claim recovery when credential persistence fails', async () => {
    const server = { client: {}, status: 'oauth_required', oauth: { state: 'pending' } };
    mockGetServer.mockReturnValue(server);
    mockUpdate.mockRejectedValue(new Error('write failed'));
    await expect(
      new MCPHubOAuthProvider('fixture', config).saveTokens({
        access_token: 'new',
        token_type: 'Bearer',
      }),
    ).rejects.toThrow('write failed');
    expect(server.status).toBe('oauth_required');
    expect(server.oauth).toBeDefined();
  });
  it('leaves clients awaiting their initial connection out of discovery', async () => {
    const server = { status: 'oauth_required' };
    mockGetServer.mockReturnValue(server);
    await new MCPHubOAuthProvider('fixture', config).saveTokens({
      access_token: 'new',
      token_type: 'Bearer',
    });
    expect(server.status).toBe('oauth_required');
  });
});
