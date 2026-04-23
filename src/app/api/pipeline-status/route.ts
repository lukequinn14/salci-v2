import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const revalidate = 300;

export const GET = async (): Promise<NextResponse> => {
  const supabase = await createClient();

  const { data } = await supabase
    .from('pipeline_runs')
    .select('run_date, computed_at, pitchers_computed, pitchers_failed, status')
    .order('computed_at', { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json({ run: data ?? null });
};
