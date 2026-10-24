import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      tier: 'FREE' | 'PRO';
      role: 'USER' | 'ADMIN';
      isAffiliate: boolean;
    };
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
    tier: 'FREE' | 'PRO';
    role: 'USER' | 'ADMIN';
    isAffiliate: boolean;
    emailVerified?: Date | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
    tier: 'FREE' | 'PRO';
    role: 'USER' | 'ADMIN';
    isAffiliate: boolean;
    /** The user's `sessionVersion` when the token was minted; a missing claim counts as 0. */
    sessionVersion?: number;
    /** Unix seconds of the sign-in; an ADMIN session ends 12 hours after it. */
    authTime?: number;
    /** The `UserSession` row of this device (CODE-02C); revoking the row ends the token. */
    sid?: string;
  }
}
