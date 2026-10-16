import { NextResponse } from 'next/server';
import { getWorldGoldSnapshot } from '@/lib/world-gold/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(): Promise<NextResponse> {
  const snapshot = await getWorldGoldSnapshot();
  return NextResponse.json(snapshot, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
