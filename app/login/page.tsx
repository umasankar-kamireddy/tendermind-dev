'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Btn, MarketingShell, MicroLabel } from '@/components/ui';

const NEXT_STEPS = [
  {
    step: '01',
    title: 'Upload a tender',
    body: 'Drop in a contract, specification or bill of quantities. Text is extracted and the document is classified automatically.',
  },
  {
    step: '02',
    title: 'Four agents review it',
    body: 'Legal, engineering and commercial assessments run together, then risk aggregates them into one decision.',
  },
  {
    step: '03',
    title: 'Decide with the evidence',
    body: 'You get a bid / no-bid recommendation, a target price with its margin, and the specific factors behind both.',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const { user, isLoading, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && user) router.replace('/');
  }, [isLoading, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const result = await login(username, password);
    setIsSubmitting(false);
    if (result.ok) {
      router.replace('/');
    } else {
      setError(result.error || 'Invalid username or password.');
    }
  };

  const inputClass =
    'w-full bg-panel border border-line px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-line-strong';

  return (
    <MarketingShell ctaHref="/welcome" ctaLabel="Back to site">
      <section className="max-w-[1180px] mx-auto px-8 py-20">
        <div className="grid gap-16 lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* Sign-in */}
          <div className="max-w-[440px]">
            <MicroLabel className="mb-4">Workspace access</MicroLabel>
            <h1 className="text-[34px] leading-[1.1] font-semibold tracking-[-0.03em]">
              Sign in to your workspace
            </h1>
            <p className="mt-4 text-[14px] leading-[1.7] text-ink-72">
              Enter your workspace credentials to continue.
            </p>

            <form onSubmit={handleSubmit} className="mt-9 space-y-5">
              <div>
                <label className="block text-[12px] text-ink-60 mb-2">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  className={inputClass}
                  placeholder="Username"
                />
              </div>
              <div>
                <label className="block text-[12px] text-ink-60 mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className={inputClass}
                  placeholder="••••••••"
                />
              </div>

              {error ? <p className="text-[13px] text-danger">{error}</p> : null}

              <Btn type="submit" variant="accent" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Signing in…' : 'Sign in'}
              </Btn>
            </form>
          </div>

          {/* What happens next */}
          <aside>
            <MicroLabel className="mb-4">What happens next</MicroLabel>
            <div className="grid gap-px bg-line border border-line">
              {NEXT_STEPS.map((s) => (
                <div key={s.step} className="bg-panel px-5 py-5">
                  <div className="font-mono text-[11px] text-accent">{s.step}</div>
                  <div className="text-[14px] font-semibold mt-2">{s.title}</div>
                  <p className="text-[12.5px] leading-[1.6] text-ink-60 mt-2">{s.body}</p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>
    </MarketingShell>
  );
}
