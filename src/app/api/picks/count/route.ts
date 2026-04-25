import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { count } = await supabase
    .from('daily_salci_scores')
    .select('pitcher_id', { count: 'exact', head: true })
    .eq('game_date', today)
    .eq('recommend_over', true);
  return NextResponse.json({ count: count ?? 0 }, {
    headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate' },
  });
}
