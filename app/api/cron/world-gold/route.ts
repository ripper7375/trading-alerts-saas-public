import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { captureWorldGoldCloses } from '@/lib/world-gold/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function GET(request: NextRequest): Promise<NextResponse> {
  const secret = process.env['CRON_SECRET']?.trim();
  if (!secret)
    return NextResponse.json(
      { error: 'World gold scheduler is not configured' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  const authorization = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  if (
    Buffer.byteLength(authorization) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(authorization), Buffer.from(expected))
  ) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    );
  }
  try {
    const result = await captureWorldGoldCloses();
    return NextResponse.json(result, {
      status: result.historyAvailable ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json(
      { error: 'World gold capture unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
