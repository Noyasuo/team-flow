const express = require('express');
const request = require('supertest');

jest.mock('../models', () => ({
  Activity: {
    deleteMany: jest.fn().mockResolvedValue({ acknowledged: true }),
  },
  Comment: {
    deleteMany: jest.fn().mockResolvedValue({ acknowledged: true }),
    distinct: jest.fn().mockResolvedValue([]),
  },
  Notification: {
    deleteMany: jest.fn().mockResolvedValue({ acknowledged: true }),
  },
  Project: {
    countDocuments: jest.fn().mockResolvedValue(0),
    deleteMany: jest.fn().mockResolvedValue({ acknowledged: true }),
    distinct: jest.fn().mockResolvedValue([]),
    find: jest.fn(),
  },
  Task: {
    countDocuments: jest.fn().mockResolvedValue(0),
    deleteMany: jest.fn().mockResolvedValue({ acknowledged: true }),
    distinct: jest.fn().mockResolvedValue([]),
    find: jest.fn(),
    findByIdAndUpdate: jest.fn().mockResolvedValue(null),
    updateMany: jest.fn().mockResolvedValue({ acknowledged: true }),
  },
  Team: {
    deleteMany: jest.fn().mockResolvedValue({ acknowledged: true }),
    distinct: jest.fn().mockResolvedValue([]),
    updateMany: jest.fn().mockResolvedValue({ acknowledged: true }),
  },
  User: {
    countDocuments: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndDelete: jest.fn().mockResolvedValue(null),
    findOne: jest.fn(),
  },
  Workspace: {
    countDocuments: jest.fn().mockResolvedValue(0),
    deleteMany: jest.fn().mockResolvedValue({ acknowledged: true }),
    distinct: jest.fn().mockResolvedValue([]),
    find: jest.fn(),
    findById: jest.fn(),
    updateMany: jest.fn().mockResolvedValue({ acknowledged: true }),
  },
}));

const models = require('../models');
const { createAdminRouter } = require('./router');

function basicAuth() {
  return `Basic ${Buffer.from('admin@teamflow.local:replace-with-a-strong-admin-password').toString('base64')}`;
}

function createUsersQuery(users) {
  return {
    sort: jest.fn().mockReturnValue({
      limit: jest.fn().mockResolvedValue(users),
    }),
  };
}

describe('admin router user management', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use('/admin', createAdminRouter({
      ADMIN_EMAIL: 'admin@teamflow.local',
      ADMIN_PASSWORD: 'replace-with-a-strong-admin-password',
    }));
  });

  it('renders a delete action in the users table', async () => {
    models.User.find.mockReturnValue(
      createUsersQuery([
        {
          _id: 'user-1',
          name: 'Alice Admin',
          email: 'alice@example.com',
          title: 'Operations',
          role: 'ADMIN',
          isActive: true,
          createdAt: new Date('2026-07-22T10:00:00.000Z'),
        },
      ])
    );
    models.User.countDocuments
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);

    const response = await request(app)
      .get('/admin/users')
      .set('Authorization', basicAuth());

    expect(response.status).toBe(200);
    expect(response.text).toContain('/admin/users/user-1/delete');
    expect(response.text).toContain('Delete this user and remove their related records?');
  });

  it('deletes a user and redirects back to the users page', async () => {
    models.User.findById.mockResolvedValue({
      _id: 'user-2',
      email: 'member@example.com',
    });

    const response = await request(app)
      .post('/admin/users/user-2/delete')
      .set('Authorization', basicAuth())
      .redirects(0);

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/admin/users?ok=User%20deleted%20successfully');
    expect(models.Workspace.updateMany).toHaveBeenCalledWith(
      { 'members.user': 'user-2' },
      { $pull: { members: { user: 'user-2' } } }
    );
    expect(models.Team.updateMany).toHaveBeenCalledWith(
      { 'members.user': 'user-2' },
      { $pull: { members: { user: 'user-2' } } }
    );
    expect(models.Task.updateMany).toHaveBeenCalledWith(
      { assignee: 'user-2' },
      { $set: { assignee: null } }
    );
    expect(models.User.findByIdAndDelete).toHaveBeenCalledWith('user-2');
  });
});
