import crypto from 'crypto';

import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { AccountExistsError } from '@/lib/auth/errors';
import { validateOrigin } from '@/lib/csrf';
import { prisma } from '@/lib/db/prisma';
import { sendVerificationEmail } from '@/lib/email/email';
import { rateLimit, RATE_LIMITS, getRateLimitHeaders } from '@/lib/rate-limit';

const registerSchema = z.object({
  email: z.string().email('Invalid email format').trim().toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(
      /[!@#$%^&*(),.?":{}|<>]/,
      'Password must contain at least one special character'
    ),
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    // CSRF origin validation
    if (!validateOrigin(request)) {
      return NextResponse.json(
        { error: 'Invalid request origin' },
        { status: 403 }
      );
    }

    // Rate limiting
    const rateLimitResult = await rateLimit(request, RATE_LIMITS.REGISTER);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again later.' },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimitResult),
        }
      );
    }

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
    const hashedPassword = await bcrypt.hash(validated.password, 12);

    // Generate secure verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Create user in database with verification token
    const user = await prisma.user.create({
      data: {
        email: validated.email,
        password: hashedPassword,
        name: validated.name,
        tier: 'FREE',
        role: 'USER',
        isAffiliate: false,
        emailVerified: null,
        verificationToken,
      },
    });

    // Send verification email
    const emailResult = await sendVerificationEmail(
      validated.email,
      validated.name || 'User',
      verificationToken
    );

    if (!emailResult.success) {
      console.error('Failed to send verification email:', emailResult.error);
      // Don't fail registration if email fails - user can request resend
    }

    const response = NextResponse.json(
      {
        success: true,
        userId: user.id,
        message:
          'Registration successful. Please check your email to verify your account.',
      },
      { status: 201 }
    );

    // Add rate limit headers
    const headers = getRateLimitHeaders(rateLimitResult);
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
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

    console.error('Registration failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
