import crypto from 'crypto';

import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { AccountExistsError } from '@/lib/auth/errors';
import { csrfErrorResponse, validateOrigin } from '@/lib/csrf';
import { prisma } from '@/lib/db/prisma';
import {
  isEmailServiceConfigured,
  sendVerificationEmail,
  sendWelcomeEmail,
} from '@/lib/email/email';

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(
      /[!@#$%^&*(),.?":{}|<>]/,
      'Password must contain at least one special character'
    ),
  name: z.string().optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  // CSRF protection: validate request origin
  if (!(await validateOrigin())) {
    return csrfErrorResponse() as NextResponse;
  }

  try {
    const body = await request.json();
    const validated = registerSchema.parse(body);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (existingUser) {
      throw new AccountExistsError('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validated.password, 10);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Check if email service is configured
    // In development without email service, auto-verify users so they can log in
    const emailConfigured = isEmailServiceConfigured();
    const autoVerify =
      !emailConfigured && process.env.NODE_ENV === 'development';

    if (autoVerify) {
      console.log(
        '[Register] Email service not configured - auto-verifying user in development'
      );
    }

    // Create user in database
    const user = await prisma.user.create({
      data: {
        email: validated.email,
        password: hashedPassword,
        name: validated.name,
        tier: 'FREE',
        role: 'USER',
        isAffiliate: false,
        // Auto-verify in development if email service not configured
        emailVerified: autoVerify ? new Date() : null,
        verificationToken: autoVerify ? null : verificationToken,
      },
    });

    // Send verification email (only if email service is configured)
    if (!autoVerify) {
      const emailResult = await sendVerificationEmail(
        validated.email,
        validated.name || 'User',
        verificationToken
      );

      if (!emailResult.success) {
        console.error('Failed to send verification email:', emailResult.error);
      }
    }

    // Send welcome email
    const welcomeResult = await sendWelcomeEmail(
      validated.email,
      validated.name || 'User'
    );

    if (!welcomeResult.success) {
      console.error('Failed to send welcome email:', welcomeResult.error);
    }

    // Return appropriate message based on verification status
    const message = autoVerify
      ? 'Registration successful. You can now log in. (Email verification skipped in development)'
      : 'Registration successful. Please check your email to verify your account.';

    return NextResponse.json(
      {
        success: true,
        userId: user.id,
        message,
        autoVerified: autoVerify,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AccountExistsError) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors?.[0]?.message || 'Validation failed' },
        { status: 400 }
      );
    }

    // Log detailed error for debugging (visible in server console only)
    console.error('Registration failed:', error);

    // Check for Prisma-specific errors
    if (error && typeof error === 'object' && 'code' in error) {
      const prismaError = error as { code: string; message?: string };
      if (prismaError.code === 'P2002') {
        return NextResponse.json(
          { error: 'A user with this email already exists' },
          { status: 409 }
        );
      }
      if (prismaError.code === 'P1001' || prismaError.code === 'P1002') {
        return NextResponse.json(
          { error: 'Service temporarily unavailable. Please try again later.' },
          { status: 503 }
        );
      }
    }

    // Check for database connection errors by message pattern
    const errMsg = error instanceof Error ? error.message : '';
    if (errMsg.includes("Can't reach database server") ||
        errMsg.includes('Connection refused') ||
        errMsg.includes('ECONNREFUSED')) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again later.' },
        { status: 503 }
      );
    }

    // Return user-friendly error message (details logged to console above)
    return NextResponse.json(
      { error: 'Registration failed. Please try again.' },
      { status: 500 }
    );
  }
}
