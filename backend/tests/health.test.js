import request from 'supertest';
import app from '../src/app.js';

describe('Health Check Endpoint', () => {
  it('GET /api/v1/health should return 200 with status ok and service name', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('service', 'workpulse-backend');
    expect(res.body).toHaveProperty('time');
  });

  it('GET /api/v1/unknown should return 404', async () => {
    const res = await request(app).get('/api/v1/unknown-endpoint');

    expect(res.statusCode).toEqual(404);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body.error).toHaveProperty('code', 'NOT_FOUND');
  });

  it('POST /api/v1/auth/login should return 501 Not Implemented', async () => {
    const res = await request(app).post('/api/v1/auth/login');

    expect(res.statusCode).toEqual(501);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body.error).toHaveProperty('code', 'NOT_IMPLEMENTED');
  });
});
