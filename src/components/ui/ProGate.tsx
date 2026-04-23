import { Lock } from 'lucide-react';
import Link from 'next/link';

interface ProGateProps {
  children: React.ReactNode;
}

const ProGate = ({ children }: ProGateProps) => (
  <div className="relative overflow-hidden rounded-xl">
    <div className="pointer-events-none select-none blur-sm">{children}</div>
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-zinc-950/80 backdrop-blur-sm">
      <div className="flex items-center justify-center rounded-full bg-emerald-500/10 p-3 ring-1 ring-emerald-500/20">
        <Lock className="text-emerald-400" size={20} />
      </div>
      <p className="text-sm font-semibold text-zinc-200">Pro Feature</p>
      <p className="text-xs text-zinc-500">Upgrade to unlock full analytics</p>
      <Link
        href="/pricing"
        className="mt-1 rounded-lg bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
      >
        Upgrade to Pro
      </Link>
    </div>
  </div>
);

export default ProGate;
