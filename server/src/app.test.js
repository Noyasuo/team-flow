const request = require('supertest');
const { createApp } = require('./app');

describe('TeamFlow API health', () => {
  it('responds with status ok', async () => {
    const app = await createApp({ JWT_SECRET: 'test-secret-12345' });

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok', service: 'teamflow-api' });
  });
});
