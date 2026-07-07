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

// Note: next-auth/react has its own mock at __mocks__/next-auth-react.js
// (mapped separately in jest.config.js) — see the comment there for why
// it must not share a file with this one.

module.exports = {
  __esModule: true,
  default: NextAuth,
  getServerSession,
  NextAuth,
};
