import { z } from 'zod';

// Validation schemas
export const loginSchema = z.object({
  email: z.string().trim().email({ message: 'Invalid email address' }),
  password: z
    .string()
    .min(6, { message: 'Password must be at least 6 characters' }),
});

export const signupSchema = z
  .object({
    email: z.string().trim().email({ message: 'Invalid email address' }),
    password: z
      .string()
      .min(6, { message: 'Password must be at least 6 characters' }),
    confirmPassword: z
      .string()
      .min(6, { message: 'Password must be at least 6 characters' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email({ message: 'Invalid email address' }),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

// Mock user type
export interface MockUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

// Mock session type
export interface MockSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: MockUser;
}

// Mock storage keys
const STORAGE_KEYS = {
  SESSION: 'mock_auth_session',
  USERS: 'mock_auth_users',
};

// Simulated delay for realistic API behavior
const simulateDelay = (ms: number = 800) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Generate mock tokens
const generateToken = () =>
  Math.random().toString(36).substring(2) + Date.now().toString(36);

// Mock Auth Service
class MockAuthService {
  private getStoredUsers(): Record<
    string,
    { password: string; user: MockUser }
  > {
    const stored = localStorage.getItem(STORAGE_KEYS.USERS);
    return stored ? JSON.parse(stored) : {};
  }

  private saveUsers(
    users: Record<string, { password: string; user: MockUser }>
  ) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }

  private saveSession(session: MockSession | null) {
    if (session) {
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
    } else {
      localStorage.removeItem(STORAGE_KEYS.SESSION);
    }
  }

  async getSession(): Promise<MockSession | null> {
    const stored = localStorage.getItem(STORAGE_KEYS.SESSION);
    if (!stored) return null;

    const session: MockSession = JSON.parse(stored);

    // Check if session is expired
    if (Date.now() > session.expiresAt) {
      this.saveSession(null);
      return null;
    }

    return session;
  }

  async login(
    input: LoginInput
  ): Promise<{ session: MockSession | null; error: string | null }> {
    await simulateDelay();

    const validation = loginSchema.safeParse(input);
    if (!validation.success) {
      return { session: null, error: validation.error.errors[0].message };
    }

    const users = this.getStoredUsers();
    const storedUser = users[input.email.toLowerCase()];

    if (!storedUser) {
      return { session: null, error: 'No account found with this email' };
    }

    if (storedUser.password !== input.password) {
      return { session: null, error: 'Invalid password' };
    }

    const session: MockSession = {
      accessToken: generateToken(),
      refreshToken: generateToken(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      user: storedUser.user,
    };

    this.saveSession(session);
    return { session, error: null };
  }

  async signup(
    input: SignupInput
  ): Promise<{ session: MockSession | null; error: string | null }> {
    await simulateDelay();

    const validation = signupSchema.safeParse(input);
    if (!validation.success) {
      return { session: null, error: validation.error.errors[0].message };
    }

    const users = this.getStoredUsers();
    const emailLower = input.email.toLowerCase();

    if (users[emailLower]) {
      return {
        session: null,
        error: 'An account with this email already exists',
      };
    }

    const newUser: MockUser = {
      id: generateToken(),
      email: emailLower,
      name: emailLower.split('@')[0],
      createdAt: new Date().toISOString(),
    };

    users[emailLower] = {
      password: input.password,
      user: newUser,
    };

    this.saveUsers(users);

    const session: MockSession = {
      accessToken: generateToken(),
      refreshToken: generateToken(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      user: newUser,
    };

    this.saveSession(session);
    return { session, error: null };
  }

  async forgotPassword(
    input: ForgotPasswordInput
  ): Promise<{ success: boolean; error: string | null }> {
    await simulateDelay();

    const validation = forgotPasswordSchema.safeParse(input);
    if (!validation.success) {
      return { success: false, error: validation.error.errors[0].message };
    }

    // In mock mode, always succeed (simulating email sent)
    return { success: true, error: null };
  }

  async logout(): Promise<void> {
    await simulateDelay(300);
    this.saveSession(null);
  }

  async refreshSession(): Promise<MockSession | null> {
    const currentSession = await this.getSession();
    if (!currentSession) return null;

    // Extend session
    const newSession: MockSession = {
      ...currentSession,
      accessToken: generateToken(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    };

    this.saveSession(newSession);
    return newSession;
  }
}

export const mockAuthService = new MockAuthService();
