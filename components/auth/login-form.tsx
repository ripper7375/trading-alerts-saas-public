'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Eye,
  EyeOff,
  Loader2,
  Check,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import SocialAuthButtons from './social-auth-buttons';

// Validation schema
const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  rememberMe: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

type ErrorType = 'invalid' | 'locked' | 'server' | null;

export default function LoginForm(): JSX.Element {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<ErrorType>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid, touchedFields },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
  });

  const onSubmit = async (data: LoginFormData): Promise<void> => {
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        // Parse error to determine type
        if (result.error.includes('locked')) {
          setError('locked');
        } else {
          setError('invalid');
        }
      } else if (result?.ok) {
        setIsSuccess(true);
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('server');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getErrorMessage = (): {
    title: string;
    subtitle?: string;
    bg: string;
    border: string;
    text: string;
    icon: string;
  } | null => {
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

  // Success state
  if (isSuccess) {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="text-center py-8">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 animate-bounce">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Welcome back!
            </h2>
            <p className="text-gray-600">Redirecting to dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-lg shadow-xl p-8">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold mb-2 text-gray-900">
            Welcome Back
          </h1>
          <p className="text-gray-600">
            Sign in to your Trading Alerts account
          </p>
        </div>

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
                  <Link
                    href="/forgot-password"
                    className="text-blue-600 underline text-sm mt-2 hover:text-blue-700 block"
                  >
                    Reset password
                  </Link>
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
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              Email Address
            </label>
            <div className="relative">
              <input
                id="email"
                type="email"
                placeholder="john@example.com"
                {...register('email')}
                className={`w-full px-3 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200 ${
                  errors.email
                    ? 'border-red-500 focus:ring-red-500'
                    : touchedFields.email && !errors.email
                      ? 'border-green-500 focus:ring-green-500'
                      : 'border-gray-300'
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
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                {...register('password')}
                className={`w-full px-3 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200 ${
                  errors.password
                    ? 'border-red-500 focus:ring-red-500'
                    : touchedFields.password && !errors.password
                      ? 'border-green-500 focus:ring-green-500'
                      : 'border-gray-300'
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
              <input
                id="rememberMe"
                type="checkbox"
                {...register('rememberMe')}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label
                htmlFor="rememberMe"
                className="text-sm text-gray-600 cursor-pointer font-normal"
              >
                Remember me for 30 days
              </label>
            </div>
            <Link
              href="/forgot-password"
              className="text-sm text-blue-600 hover:underline font-medium"
            >
              Forgot password?
            </Link>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 py-3 text-lg font-semibold rounded-md text-white shadow-lg transition-all duration-200 disabled:bg-gray-300 disabled:cursor-not-allowed"
            disabled={isSubmitting || !isValid}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="inline h-5 w-5 animate-spin mr-2" />
                <span className="opacity-70">Signing in...</span>
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-gray-400">OR</span>
          </div>
        </div>

        {/* Social Login Buttons */}
        <SocialAuthButtons />

        {/* Footer Links */}
        <div className="text-center mt-6">
          <span className="text-gray-600">Don&apos;t have an account?</span>
          <Link
            href="/register"
            className="text-blue-600 font-semibold hover:underline ml-1"
          >
            Sign up for free →
          </Link>
        </div>
      </div>
    </div>
  );
}
