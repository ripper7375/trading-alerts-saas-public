import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { User, UserRole, Tier } from '@/lib/types';

interface AuthContextType {
  user: User | null;
  role: UserRole;
  tier: Tier;
  isPro: boolean;
  isAffiliate: boolean;
  isLoading: boolean;
  login: (
    email: string,
    password?: string
  ) => Promise<{ error: string | null }>;
  signup: (
    email: string,
    password?: string,
    name?: string,
    referralCode?: string
  ) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  switchRole: (newRole: UserRole) => void;
  updateUser: (updates: Partial<User>) => void;
}

const DEFAULT_USERS: Record<UserRole, User | null> = {
  NL: null,
  FT: {
    id: 'usr_ft_001',
    email: 'trader.free@davintrade.com',
    name: 'Alex Trader (Free)',
    role: 'FT',
    tier: 'FREE',
    isAffiliate: false,
    tokensUsed: 12500,
    maxTokens: 50000,
    createdAt: '2026-01-15T08:00:00Z',
  },
  PT: {
    id: 'usr_pt_002',
    email: 'pro.trader@davintrade.com',
    name: 'Sarah Jenkins (PRO)',
    role: 'PT',
    tier: 'PRO',
    isAffiliate: false,
    tokensUsed: 42500,
    maxTokens: 500000,
    createdAt: '2025-11-20T10:30:00Z',
  },
  AF: {
    id: 'usr_af_003',
    email: 'affiliate.free@davintrade.com',
    name: 'Marcus Vance (Partner Free)',
    role: 'AF',
    tier: 'FREE',
    isAffiliate: true,
    affiliateCode: 'MARCUS20',
    tokensUsed: 8900,
    maxTokens: 50000,
    createdAt: '2026-02-01T12:00:00Z',
  },
  AP: {
    id: 'usr_ap_004',
    email: 'vip.affiliate@davintrade.com',
    name: 'Elena Rostova (VIP Partner PRO)',
    role: 'AP',
    tier: 'PRO',
    isAffiliate: true,
    affiliateCode: 'ELENA_VIP',
    tokensUsed: 128400,
    maxTokens: 500000,
    createdAt: '2025-09-10T14:15:00Z',
  },
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  // Default to Pro Tier for immediate rich testing or read from localStorage
  const [role, setRole] = useState<UserRole>(() => {
    const saved = localStorage.getItem('davintrade_user_role') as UserRole;
    return saved && DEFAULT_USERS[saved] !== undefined ? saved : 'PT';
  });

  const [user, setUser] = useState<User | null>(() => DEFAULT_USERS[role]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem('davintrade_user_role', role);
    setUser(DEFAULT_USERS[role]);
  }, [role]);

  const switchRole = useCallback((newRole: UserRole) => {
    setRole(newRole);
    setUser(DEFAULT_USERS[newRole]);
  }, []);

  const login = useCallback(
    async (email: string, _password?: string) => {
      setIsLoading(true);
      try {
        // Simulate auth lookup or default to Pro
        let targetRole: UserRole = 'PT';
        if (email.includes('free')) targetRole = 'FT';
        else if (email.includes('affiliate')) targetRole = 'AF';
        else if (email.includes('vip')) targetRole = 'AP';

        switchRole(targetRole);
        return { error: null };
      } catch (err: any) {
        return { error: err.message || 'Login failed' };
      } finally {
        setIsLoading(false);
      }
    },
    [switchRole]
  );

  const signup = useCallback(
    async (
      email: string,
      _password?: string,
      name?: string,
      referralCode?: string
    ) => {
      setIsLoading(true);
      try {
        const newUser: User = {
          id: `usr_${Date.now()}`,
          email,
          name: name || 'New Trader',
          role: referralCode ? 'AF' : 'FT',
          tier: 'FREE',
          isAffiliate: !!referralCode,
          affiliateCode: referralCode,
          tokensUsed: 0,
          maxTokens: 50000,
          createdAt: new Date().toISOString(),
        };
        setUser(newUser);
        setRole(newUser.role);
        return { error: null };
      } catch (err: any) {
        return { error: err.message || 'Registration failed' };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const logout = useCallback(async () => {
    switchRole('NL');
  }, [switchRole]);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : null));
  }, []);

  const isPro = user?.tier === 'PRO';
  const isAffiliate = user?.isAffiliate ?? false;
  const tier: Tier = user?.tier ?? 'FREE';

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        tier,
        isPro,
        isAffiliate,
        isLoading,
        login,
        signup,
        logout,
        switchRole,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
