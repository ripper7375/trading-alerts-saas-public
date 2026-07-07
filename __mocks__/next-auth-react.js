// Mock for next-auth/react — kept separate from __mocks__/next-auth.js
// (the server package) because jest.setup.js does
// `jest.mock('next-auth', () => ({...}))` globally, and Jest's mock
// registry keys mocks by *resolved file path*. If 'next-auth' and
// 'next-auth/react' mapped to the same file via moduleNameMapper, that
// global factory (which has no useSession) would shadow this one for both
// specifiers. Keeping them as distinct files avoids the collision.
//
// Default: unauthenticated, no session. Tests that need a specific
// session/tier should add their own
// jest.mock('next-auth/react', () => ({ useSession: () => ... })) —
// an inline jest.mock in a test file always takes precedence over this
// shared moduleNameMapper-based mock.

const useSession = jest.fn(() => ({
  data: null,
  status: 'unauthenticated',
}));
const signIn = jest.fn();
const signOut = jest.fn();
const SessionProvider = ({ children }) => children;
const getSession = jest.fn(() => Promise.resolve(null));
const getCsrfToken = jest.fn(() => Promise.resolve('mock-csrf-token'));
const getProviders = jest.fn(() => Promise.resolve({}));

module.exports = {
  __esModule: true,
  useSession,
  signIn,
  signOut,
  SessionProvider,
  getSession,
  getCsrfToken,
  getProviders,
};
