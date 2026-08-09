jest.mock('mongoose', () => {
  const connection = {
    readyState: 0,
    on: jest.fn(),
    once: jest.fn(),
  };

  return {
    set: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    connection,
    Types: {
      ObjectId: jest.fn(),
    },
  };
});

const mongoose = require('mongoose');
const { connectDatabase, closeDatabase } = require('./db');

describe('database connection helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mongoose.connection.readyState = 0;
    mongoose.connect.mockResolvedValue(undefined);
  });

  it('connects to MongoDB when no connection exists', async () => {
    const connection = await connectDatabase('mongodb://localhost:27017/teamflow');

    expect(mongoose.set).toHaveBeenCalledWith('strictQuery', true);
    expect(mongoose.connect).toHaveBeenCalledWith(
      'mongodb://localhost:27017/teamflow',
      expect.objectContaining({
        autoIndex: true,
        serverSelectionTimeoutMS: 10000,
      })
    );
    expect(connection).toBe(mongoose.connection);
  });

  it('returns the existing connection when already connected', async () => {
    mongoose.connection.readyState = 1;

    const connection = await connectDatabase('mongodb://localhost:27017/teamflow');

    expect(mongoose.connect).not.toHaveBeenCalled();
    expect(connection).toBe(mongoose.connection);
  });

  it('disconnects from MongoDB', async () => {
    mongoose.connection.readyState = 1;

    await closeDatabase();

    expect(mongoose.disconnect).toHaveBeenCalled();
  });
});
