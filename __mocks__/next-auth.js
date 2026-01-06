// Mock for next-auth to prevent ESM parsing issues in Jest
// This file is automatically used by Jest when next-auth is imported

const mockSession = null;

const getServerSession = jest.fn(() => Promise.resolve(mockSession));

const NextAuth = jest.fn(() => ({
  handlers: { GET: jest.fn(), POST: jest.fn() },
  auth: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
}));

module.exports = {
  __esModule: true,
  default: NextAuth,
  getServerSession,
  NextAuth,
};
