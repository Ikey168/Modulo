import { rest } from 'msw';

export const handlers = [
  // Auth endpoints
  rest.post('/api/auth/login', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        token: 'mock-jwt-token',
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
        },
      })
    );
  }),

  rest.post('/api/auth/logout', (req, res, ctx) => {
    return res(ctx.status(200));
  }),

  rest.get('/api/auth/me', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
      })
    );
  }),

  // Notes endpoints
  rest.get('/api/notes', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json([
        {
          id: '1',
          title: 'Test Note 1',
          content: 'This is a test note',
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
          userId: '1',
        },
        {
          id: '2',
          title: 'Test Note 2',
          content: 'Another test note',
          createdAt: '2023-01-02T00:00:00Z',
          updatedAt: '2023-01-02T00:00:00Z',
          userId: '1',
        },
      ])
    );
  }),

  rest.post('/api/notes', (req, res, ctx) => {
    return res(
      ctx.status(201),
      ctx.json({
        id: '3',
        title: 'New Note',
        content: 'New note content',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: '1',
      })
    );
  }),

  rest.put('/api/notes/:id', (req, res, ctx) => {
    const { id } = req.params;
    return res(
      ctx.status(200),
      ctx.json({
        id,
        title: 'Updated Note',
        content: 'Updated content',
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: new Date().toISOString(),
        userId: '1',
      })
    );
  }),

  rest.delete('/api/notes/:id', (req, res, ctx) => {
    return res(ctx.status(204));
  }),

  // Search endpoint
  rest.get('/api/search', (req, res, ctx) => {
    const query = req.url.searchParams.get('q');
    return res(
      ctx.status(200),
      ctx.json({
        results: [
          {
            id: '1',
            title: `Search result for: ${query}`,
            content: 'Matching content',
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-01-01T00:00:00Z',
            userId: '1',
          },
        ],
        total: 1,
      })
    );
  }),

  // Network/Graph endpoints
  rest.get('/api/network/nodes', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json([
        { id: 'node1', label: 'Test Node 1', size: 10 },
        { id: 'node2', label: 'Test Node 2', size: 15 },
      ])
    );
  }),

  rest.get('/api/network/edges', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json([
        { id: 'edge1', source: 'node1', target: 'node2', weight: 1 },
      ])
    );
  }),

  // Wallet/Blockchain endpoints
  rest.get('/api/wallet/balance', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        balance: '1000.0',
        currency: 'ETH',
      })
    );
  }),
];
