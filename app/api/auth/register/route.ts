import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { AccountExistsError } from '@/lib/auth/errors';
import { prisma } from '@/lib/db/prisma';

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
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

    // Create user in database
    const user = await prisma.user.create({
      data: {
        email: validated.email,
        password: hashedPassword,
        name: validated.name,
        tier: 'FREE',
        role: 'USER',
        isAffiliate: false,
        emailVerified: null,
      },
    });

    // Generate verification token (placeholder for now)
    const verificationToken = Math.random().toString(36).substring(2, 15);
    console.error(
      `Verification email would be sent to: ${validated.email} with token: ${verificationToken}`
    );

    return NextResponse.json({
      success: true,
      userId: user.id,
      message:
        'Registration successful. Please check your email to verify your account.',
    });
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
