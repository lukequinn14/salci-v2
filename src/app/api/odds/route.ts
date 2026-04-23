import { NextResponse } from 'next/server';
import { getStrikeoutLines } from '@/lib/odds/fetcher';

export const GET = async (): Promise<NextResponse> => {
  const lines = await getStrikeoutLines();
  return NextResponse.json({ lines });
};
