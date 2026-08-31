import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Eye,
  EyeOff,
  Loader2,
  ArrowLeft,
  TrendingUp,
  Trophy,
  GraduationCap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { z } from 'zod';
import { cn } from '@/lib/utils';

// Validation schemas
const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signupSchema = z
  .object({
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z
      .string()
      .min(6, 'Password must be at least 6 characters'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type LoginInput = z.infer<typeof loginSchema>;
type SignupInput = z.infer<typeof signupSchema>;
type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

type AuthView = 'login' | 'signup' | 'forgot-password';

// Same-origin relative path only, so OAuth consent flows can return here safely.
export function useNextPath() {
  const [params] = useSearchParams();
  const next = params.get('next');
  if (next && next.startsWith('/') && !next.startsWith('//')) return next;
  return '/dashboard';
}

export default function Auth() {
  const [view, setView] = useState<AuthView>('login');
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const nextPath = useNextPath();

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      navigate(nextPath, { replace: true });
    }
  }, [user, authLoading, navigate, nextPath]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="safe-area-pt flex min-h-screen flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        {view !== 'login' && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setView('login')}
            className="h-10 w-10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Logo Section */}
      <div className="flex flex-col items-center pb-12 pt-8">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
          <TrendingUp className="h-8 w-8 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Trading Alerts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {view === 'login' && 'Welcome back'}
          {view === 'signup' && 'Create your account'}
          {view === 'forgot-password' && 'Reset your password'}
        </p>
      </div>

      {/* Form Section */}
      <div className="flex-1 px-6">
        {view === 'login' && (
          <LoginForm onForgotPassword={() => setView('forgot-password')} />
        )}
        {view === 'signup' && <SignupForm />}
        {view === 'forgot-password' && (
          <ForgotPasswordForm onBack={() => setView('login')} />
        )}
      </div>

      {/* Footer */}
      <div className="space-y-4 p-6 text-center">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => navigate('/academy')}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-600 hover:underline dark:text-amber-400"
          >
            <GraduationCap className="h-4 w-4" />
            Browse Academy
          </button>
          <button
            onClick={() => navigate('/affiliate/leaderboard')}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-600 hover:underline dark:text-amber-400"
          >
            <Trophy className="h-4 w-4" />
            See Top Earners
          </button>
        </div>

        {view === 'login' && (
          <p className="text-sm text-muted-foreground">
            Don't have an account?{' '}
            <button
              onClick={() => setView('signup')}
              className="font-medium text-primary hover:underline"
            >
              Sign up
            </button>
          </p>
        )}
        {view === 'signup' && (
          <p className="text-sm text-muted-foreground">
            Already have an account?{' '}
            <button
              onClick={() => setView('login')}
              className="font-medium text-primary hover:underline"
            >
              Log in
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

// Login Form Component
function LoginForm({ onForgotPassword }: { onForgotPassword: () => void }) {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();
  const nextPath = useNextPath();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    setError(null);
    const result = await login(data.email, data.password);
    if (result.error) {
      setError(result.error);
    } else {
      navigate(nextPath, { replace: true });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          {...register('email')}
          className={cn(errors.email && 'border-destructive')}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            autoComplete="current-password"
            {...register('password')}
            className={cn('pr-10', errors.password && 'border-destructive')}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onForgotPassword}
          className="text-sm text-primary hover:underline"
        >
          Forgot password?
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <Button type="submit" className="h-12 w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Log in'}
      </Button>
    </form>
  );
}

// Signup Form Component
function SignupForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signup } = useAuth();
  const navigate = useNavigate();
  const nextPath = useNextPath();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupInput) => {
    setError(null);
    const result = await signup(data.email, data.password);
    if (result.error) {
      setError(result.error);
    } else {
      navigate(nextPath, { replace: true });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="signup-email">Email</Label>
        <Input
          id="signup-email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          {...register('email')}
          className={cn(errors.email && 'border-destructive')}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-password">Password</Label>
        <div className="relative">
          <Input
            id="signup-password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            autoComplete="new-password"
            {...register('password')}
            className={cn('pr-10', errors.password && 'border-destructive')}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirm Password</Label>
        <Input
          id="confirm-password"
          type={showPassword ? 'text' : 'password'}
          placeholder="••••••••"
          autoComplete="new-password"
          {...register('confirmPassword')}
          className={cn(errors.confirmPassword && 'border-destructive')}
        />
        {errors.confirmPassword && (
          <p className="text-sm text-destructive">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <Button type="submit" className="h-12 w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          'Create account'
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        By signing up, you agree to our Terms of Service and Privacy Policy
      </p>
    </form>
  );
}

// Forgot Password Form Component
function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { forgotPassword } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordInput) => {
    setError(null);
    const result = await forgotPassword(data.email);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <div className="space-y-6 text-center">
        <div className="rounded-lg border border-primary/20 bg-primary/10 p-4">
          <p className="text-sm text-foreground">
            If an account exists with that email, you'll receive a password
            reset link shortly.
          </p>
        </div>
        <Button onClick={onBack} variant="outline" className="h-12 w-full">
          Back to login
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <p className="mb-6 text-sm text-muted-foreground">
        Enter your email address and we'll send you a link to reset your
        password.
      </p>

      <div className="space-y-2">
        <Label htmlFor="reset-email">Email</Label>
        <Input
          id="reset-email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          {...register('email')}
          className={cn(errors.email && 'border-destructive')}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <Button type="submit" className="h-12 w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          'Send reset link'
        )}
      </Button>
    </form>
  );
}
