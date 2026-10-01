import { Server } from '@/types';

export type ServerFilter = 'all' | 'online' | 'issues' | 'disabled';
export type ServerSort = 'oldest' | 'newest' | 'name-asc' | 'name-desc';
export const SERVER_SORTS: ServerSort[] = ['oldest', 'newest', 'name-asc', 'name-desc'];

// Missing timestamps belong to legacy servers. Preserve their stored order
// and place them before newly created servers in the default oldest-first view.
export const sortServers = (servers: Server[], sort: ServerSort): Server[] => {
  const storedOrder = new Map(servers.map((server, index) => [server.name, index]));
  return [...servers].sort((a, b) => {
    const enabledOrder = Number(a.enabled === false) - Number(b.enabled === false);
    if (enabledOrder) return enabledOrder;
    if (sort === 'name-asc' || sort === 'name-desc') {
      const order = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      return sort === 'name-desc' ? -order : order;
    }
    const time = (server: Server) => {
      const parsed = server.createdAt ? Date.parse(server.createdAt) : 0;
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const order = time(a) - time(b) || storedOrder.get(a.name)! - storedOrder.get(b.name)!;
    return sort === 'newest' ? -order : order;
  });
};

export interface ServerPageInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export const getServerFilterCounts = (servers: Server[]) => ({
  all: servers.length,
  online: servers.filter((server) => server.status === 'connected').length,
  issues: servers.filter((server) => server.status !== 'connected' && server.enabled !== false)
    .length,
  disabled: servers.filter((server) => server.enabled === false).length,
});

export const filterServers = (servers: Server[], filter: ServerFilter, search = ''): Server[] => {
  const query = search.trim().toLowerCase();

  return servers.filter((server) => {
    if (filter === 'online' && server.status !== 'connected') return false;
    if (filter === 'issues' && (server.status === 'connected' || server.enabled === false))
      return false;
    if (filter === 'disabled' && server.enabled !== false) return false;
    if (!query) return true;

    const haystack = (
      server.name +
      ' ' +
      (server.config?.description || '') +
      ' ' +
      (server.tools?.map((tool) => tool.name).join(' ') || '')
    ).toLowerCase();

    return haystack.includes(query);
  });
};

// Filters the full server list then paginates the filtered result client-side.
// Filtering must run against the complete list, not a single pagination page, so
// that servers on other pages remain reachable when a status filter is active.
export const selectServerPage = (
  allServers: Server[],
  filter: ServerFilter,
  search: string,
  page: number,
  limit: number,
  sort: ServerSort = 'oldest',
): { servers: Server[]; pagination: ServerPageInfo } => {
  const filtered = sortServers(filterServers(allServers, filter, search), sort);
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * limit;

  return {
    servers: filtered.slice(start, start + limit),
    pagination: {
      page: safePage,
      limit,
      total,
      totalPages,
      hasNextPage: safePage < totalPages,
      hasPrevPage: safePage > 1,
    },
  };
};
