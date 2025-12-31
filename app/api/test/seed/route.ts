/**
 * Test Seed API Endpoint
 *
 * Creates test users for E2E testing. Only works in development/test environment.
 *
 * @module app/api/test/seed/route
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

import { prisma } from '@/lib/db/prisma';

// Only allow in development or test environment
const ALLOWED_ENVIRONMENTS = ['development', 'test'];

// Test user configurations matching e2e/utils/test-data.ts
const TEST_USERS = [
    {
        email: 'free-test@trading-alerts.test',
        password: 'TestPassword123!',
        name: 'Free Test User',
        tier: 'FREE' as const,
        role: 'USER',
    },
    {
        email: 'pro-test@trading-alerts.test',
        password: 'TestPassword123!',
        name: 'Pro Test User',
        tier: 'PRO' as const,
        role: 'USER',
    },
    {
        email: 'admin-test@trading-alerts.test',
        password: 'AdminPassword123!',
        name: 'Admin Test User',
        tier: 'FREE' as const,
        role: 'ADMIN',
    },
    {
        email: 'affiliate-test@trading-alerts.test',
        password: 'AffiliatePassword123!',
        name: 'Affiliate Test User',
        tier: 'FREE' as const,
        role: 'USER',
        isAffiliate: true,
    },
    {
        email: 'unverified@trading-alerts.test',
        password: 'TestPassword123!',
        name: 'Unverified User',
        tier: 'FREE' as const,
        role: 'USER',
        emailVerified: null, // Explicitly null to indicate unverified
    },
];

export async function POST(request: NextRequest): Promise<NextResponse> {
    // Check environment
    const nodeEnv = process.env.NODE_ENV || 'production';
    if (!ALLOWED_ENVIRONMENTS.includes(nodeEnv)) {
        return NextResponse.json(
            { error: 'Test seed endpoint only available in development/test environment' },
            { status: 403 }
        );
    }

    // Optional: Check for test secret header for additional security
    const testSecret = request.headers.get('x-test-secret');
    const expectedSecret = process.env.TEST_SECRET || 'test-secret';
    if (testSecret && testSecret !== expectedSecret) {
        return NextResponse.json(
            { error: 'Invalid test secret' },
            { status: 401 }
        );
    }

    try {
        const createdUsers: { id: string; email: string; tier: string; role: string }[] = [];

        for (const userData of TEST_USERS) {
            // Hash password
            const hashedPassword = await bcrypt.hash(userData.password, 10);

            // Upsert user (create or update if exists)
            const user = await prisma.user.upsert({
                where: { email: userData.email },
                update: {
                    password: hashedPassword,
                    name: userData.name,
                    tier: userData.tier,
                    role: userData.role,
                    isAffiliate: userData.isAffiliate ?? false,
                    emailVerified: userData.emailVerified === null ? null : new Date(),
                    isActive: true,
                },
                create: {
                    email: userData.email,
                    password: hashedPassword,
                    name: userData.name,
                    tier: userData.tier,
                    role: userData.role,
                    isAffiliate: userData.isAffiliate ?? false,
                    emailVerified: userData.emailVerified === null ? null : new Date(),
                    isActive: true,
                },
            });

            createdUsers.push({
                id: user.id,
                email: user.email,
                tier: user.tier,
                role: user.role,
            });
        }

        // Create PRO subscription for pro-test user
        const proUser = createdUsers.find((u) => u.email === 'pro-test@trading-alerts.test');
        if (proUser) {
            await prisma.subscription.upsert({
                where: { userId: proUser.id },
                update: {
                    status: 'ACTIVE',
                    amountUsd: 29.0,
                    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
                },
                create: {
                    userId: proUser.id,
                    status: 'ACTIVE',
                    amountUsd: 29.0,
                    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
                },
            });
        }

        return NextResponse.json({
            success: true,
            message: `Seeded ${createdUsers.length} test users`,
            users: createdUsers,
        });
    } catch (error) {
        console.error('Test seed error:', error);
        return NextResponse.json(
            { error: 'Failed to seed test data', details: String(error) },
            { status: 500 }
        );
    }
}

// GET endpoint to check if seed is available
export async function GET(): Promise<NextResponse> {
    const nodeEnv = process.env.NODE_ENV || 'production';

    if (!ALLOWED_ENVIRONMENTS.includes(nodeEnv)) {
        return NextResponse.json(
            { available: false, reason: 'Only available in development/test' },
            { status: 403 }
        );
    }

    return NextResponse.json({
        available: true,
        environment: nodeEnv,
        testUsers: TEST_USERS.map((u) => ({
            email: u.email,
            tier: u.tier,
            role: u.role,
        })),
    });
}

// DELETE endpoint to clean up test users
export async function DELETE(request: NextRequest): Promise<NextResponse> {
    const nodeEnv = process.env.NODE_ENV || 'production';
    if (!ALLOWED_ENVIRONMENTS.includes(nodeEnv)) {
        return NextResponse.json(
            { error: 'Test seed endpoint only available in development/test environment' },
            { status: 403 }
        );
    }

    try {
        // Delete test users by email pattern
        const result = await prisma.user.deleteMany({
            where: {
                email: {
                    endsWith: '@trading-alerts.test',
                },
            },
        });

        return NextResponse.json({
            success: true,
            message: `Deleted ${result.count} test users`,
            count: result.count,
        });
    } catch (error) {
        console.error('Test cleanup error:', error);
        return NextResponse.json(
            { error: 'Failed to cleanup test data', details: String(error) },
            { status: 500 }
        );
    }
}
