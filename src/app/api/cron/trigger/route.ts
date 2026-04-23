import { NextResponse } from 'next/server';
import { runSalciPipeline } from '@/lib/pipeline/compute';

export const POST = async (request: Request): Promise<NextResponse> => {
  // In production, require DEV_SECRET header. In development, always allow.
  if (process.env.NODE_ENV === 'production') {
    const devSecret = request.headers.get('x-dev-secret');
    if (!devSecret || devSecret !== process.env.DEV_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const gameDate = new Date().toISOString().slice(0, 10);

  try {
    const result = await runSalciPipeline(gameDate);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message, date: gameDate }, { status: 500 });
  }
};
