import { NextResponse } from 'next/server';
import { runSalciPipeline } from '@/lib/pipeline/compute';

export const GET = async (request: Request): Promise<NextResponse> => {
  const secret = request.headers.get('x-cron-secret');
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
