'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Eye, EyeOff, Loader2, Check, AlertCircle, Github } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import Link from 'next/link';

// Validation schema
const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  rememberMe: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

type ErrorType = 'invalid' | 'locked' | 'server' | null;

interface LoginFormProps {
  onSuccess?: () => void;
  onForgotPassword?: () => void;
}

// Mock authentication function
const mockAuthenticate = async (
  email: string,
  password: string
): Promise<{ success: boolean; error?: ErrorType }> => {
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Simulate different scenarios
  if (email === 'locked@example.com') {
    return { success: false, error: 'locked' };
  }
  if (email === 'error@example.com') {
    return { success: false, error: 'server' };
  }
  if (password === 'wrongpassword') {
    return { success: false, error: 'invalid' };
  }

  return { success: true };
};

export function LoginForm({ onSuccess, onForgotPassword }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ErrorType>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid, touchedFields },
    watch,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
  });

  const emailValue = watch('email');
  const passwordValue = watch('password');

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await mockAuthenticate(data.email, data.password);

      if (result.success) {
        setIsSuccess(true);
        setTimeout(() => {
          onSuccess?.();
        }, 1500);
      } else {
        setError(result.error || 'invalid');
      }
    } catch (err) {
      setError('server');
    } finally {
      setIsLoading(false);
    }
  };

  const getErrorMessage = () => {
    switch (error) {
      case 'invalid':
        return {
          title: 'Invalid email or password. Please try again.',
          bg: 'bg-red-50',
          border: 'border-red-500',
          text: 'text-red-800',
          icon: 'text-red-600',
        };
      case 'locked':
        return {
          title:
            'Your account has been locked due to too many failed login attempts.',
          subtitle: 'Please reset your password or contact support.',
          bg: 'bg-orange-50',
          border: 'border-orange-500',
          text: 'text-orange-800',
          icon: 'text-orange-600',
        };
      case 'server':
        return {
          title: 'Something went wrong. Please try again later.',
          bg: 'bg-red-50',
          border: 'border-red-500',
          text: 'text-red-800',
          icon: 'text-red-600',
        };
      default:
        return null;
    }
  };

  const errorConfig = getErrorMessage();

  if (isSuccess) {
    return (
      <Card className="w-full max-w-md shadow-xl">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="text-6xl text-green-600 mb-4 animate-in zoom-in duration-500">
            ✅
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome back!
          </h2>
          <p className="text-gray-600">Redirecting to dashboard...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md shadow-xl rounded-xl">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-3xl font-bold mb-2">Welcome Back</CardTitle>
        <CardDescription className="text-gray-600">
          Sign in to your Trading Alerts account
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        {/* Error Alert */}
        {error && errorConfig && (
          <div
            className={`${errorConfig.bg} border-l-4 ${errorConfig.border} rounded-lg p-4 mb-6 relative animate-in slide-in-from-top duration-300`}
          >
            <div className="flex items-start gap-3">
              <AlertCircle
                className={`${errorConfig.icon} flex-shrink-0 mt-0.5`}
                size={20}
              />
              <div className="flex-1">
                <p className={`${errorConfig.text} font-medium text-sm`}>
                  {errorConfig.title}
                </p>
                {errorConfig.subtitle && (
                  <p className={`${errorConfig.text} text-sm mt-1`}>
                    {errorConfig.subtitle}
                  </p>
                )}
                {error === 'locked' && (
                  <button
                    onClick={onForgotPassword}
                    className="text-blue-600 underline text-sm mt-2 hover:text-blue-700"
                  >
                    Reset password
                  </button>
                )}
              </div>
              <button
                onClick={() => setError(null)}
                className={`${errorConfig.icon} hover:opacity-70 text-xl font-bold cursor-pointer`}
              >
                ×
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Email Field */}
          <div className="space-y-2">
            <Label htmlFor="email" className="font-medium text-gray-700">
              Email Address
            </Label>
            <div className="relative">
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                {...register('email')}
                className={`pr-10 transition-all duration-200 ${
                  errors.email
                    ? 'border-red-500 focus:ring-red-500'
                    : touchedFields.email && !errors.email
                      ? 'border-green-500 focus:ring-green-500'
                      : ''
                }`}
                aria-describedby={errors.email ? 'email-error' : undefined}
              />
              {touchedFields.email && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {errors.email ? (
                    <AlertCircle className="text-red-600" size={20} />
                  ) : (
                    <Check className="text-green-600" size={20} />
                  )}
                </div>
              )}
            </div>
            {errors.email && (
              <p
                id="email-error"
                className="text-red-600 text-sm mt-1 flex items-center gap-1"
              >
                <span>⚠️</span>
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <Label htmlFor="password" className="font-medium text-gray-700">
              Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                {...register('password')}
                className={`pr-10 transition-all duration-200 ${
                  errors.password
                    ? 'border-red-500 focus:ring-red-500'
                    : touchedFields.password && !errors.password
                      ? 'border-green-500 focus:ring-green-500'
                      : ''
                }`}
                aria-describedby={
                  errors.password ? 'password-error' : undefined
                }
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 cursor-pointer transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {errors.password && (
              <p
                id="password-error"
                className="text-red-600 text-sm mt-1 flex items-center gap-1"
              >
                <span>⚠️</span>
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                id="rememberMe"
                {...register('rememberMe')}
                className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
              />
              <Label
                htmlFor="rememberMe"
                className="text-sm text-gray-600 cursor-pointer font-normal"
              >
                Remember me for 30 days
              </Label>
            </div>
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-sm text-blue-600 hover:underline font-medium"
            >
              Forgot password?
            </button>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 py-6 text-lg font-semibold rounded-lg shadow-lg transition-all duration-200 disabled:bg-gray-300 disabled:cursor-not-allowed"
            disabled={isLoading || !isValid}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                <span className="opacity-70">Signing in...</span>
              </>
            ) : (
              'Sign In'
            )}
          </Button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-gray-400">OR</span>
          </div>
        </div>

        {/* Social Login Buttons */}
        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            className="w-full border-2 border-gray-300 py-6 rounded-lg hover:bg-gray-50 transition-all duration-200 bg-transparent"
            onClick={() => console.log('Google login')}
          >
            <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span className="font-medium text-gray-700">
              Continue with Google
            </span>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full border-2 border-gray-300 py-6 rounded-lg hover:bg-gray-50 transition-all duration-200 bg-transparent"
            onClick={() => console.log('GitHub login')}
          >
            <Github className="w-5 h-5 mr-3" />
            <span className="font-medium text-gray-700">
              Continue with GitHub
            </span>
          </Button>
        </div>

        {/* Footer Links */}
        <div className="text-center mt-6">
          <span className="text-gray-600">Don't have an account?</span>
          <Link
            href="/signup"
            className="text-blue-600 font-semibold hover:underline ml-1"
          >
            Sign up for free →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
