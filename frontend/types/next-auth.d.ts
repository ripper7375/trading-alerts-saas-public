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
  }
}
