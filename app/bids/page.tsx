'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { Btn, MicroLabel, RuledNote, riskTextClass } from '@/components/ui';
import { useAuth } from '@/lib/auth';

interface Bid {
  id: string;
  file_name: string;
  doc_type: string;
  risk_score: number;
  created_at: string;
  recommendation: Record<string, unknown>;
  risk_factors: Record<string, unknown>;
}

/** Shared column track so the header rule and the rows stay aligned. */
const COLS =
  'grid grid-cols-[minmax(0,1fr)_120px_90px_100px_150px_170px_150px] gap-4 items-center';

/**
 * The stored risk_score is a 0-1 fraction; the design shows risk as a band
 * (LOW/MEDIUM/HIGH) with the percentage as a secondary mono figure, matching
 * the thresholds agents/risk.py uses to derive risk_level.
 */
function riskLevel(score: number): string {
  if (score < 0.33) return 'LOW';
  if (score < 0.67) return 'MEDIUM';
  return 'HIGH';
}

export default function BidsPage() {
  const { token } = useAuth();
  const [bids, setBids] = useState<Bid[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchBids = async () => {
      // Cleared per attempt: this effect re-runs when the token arrives, and
      // the first (unauthenticated) attempt's 401 must not survive the
      // successful retry - it rendered an error banner above a loaded table.
      setError(null);
      try {
        const response = await fetch('/api/bids?limit=50', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) throw new Error('Failed to fetch bids');
        const data = await response.json();
        setBids(data.bids || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchBids();
  }, [token]);

  const handleDelete = async (bid: Bid) => {
    if (
      !confirm(
        `Remove "${bid.file_name}" from bid history? This also deletes the agent memories learned from this document. This cannot be undone.`,
      )
    ) {
      return;
    }

    setDeletingId(bid.id);
    try {
      const response = await fetch(`/api/bid/${bid.id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Failed to delete bid');
      setBids((prev) => prev.filter((b) => b.id !== bid.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete bid');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <AppShell
      title="Bid history"
      subtitle="Review previous document analyses and bid recommendations"
      actions={
        <Btn href="/" variant="accent">
          New analysis
        </Btn>
      }
    >
      <div className="font-mono text-[12px] text-ink-60 -mt-4 mb-8">
        {isLoading
          ? 'Loading…'
          : `${bids.length} analysed ${bids.length === 1 ? 'document' : 'documents'}`}
      </div>

      {isLoading ? (
        <div className="border border-line px-4 py-16 text-center">
          <div className="font-mono text-[12px] text-ink-45">Loading bid history…</div>
        </div>
      ) : error ? (
        <RuledNote tone="danger">{error}</RuledNote>
      ) : bids.length === 0 ? (
        <div className="border border-line px-4 py-16 text-center">
          <p className="text-[14px] text-ink-60">No documents analysed yet.</p>
          <div className="mt-6 flex justify-center">
            <Btn href="/" variant="accent">
              Upload your first document
            </Btn>
          </div>
        </div>
      ) : (
        <div className="border border-line overflow-x-auto">
          <div className="min-w-[1080px]">
            <div className={`${COLS} px-4 py-2.5 border-b border-line bg-panel`}>
              <div className="micro">File name</div>
              <div className="micro">Type</div>
              <div className="micro">Risk</div>
              <div className="micro">Bid?</div>
              <div className="micro">Recommendation</div>
              <div className="micro">Uploaded</div>
              <div className="micro">Action</div>
            </div>

            {bids.map((bid) => {
              const decision = String(bid.risk_factors?.bid_decision || '').toUpperCase();
              const price = bid.recommendation?.recommended_bid_price;
              const level = riskLevel(bid.risk_score);

              return (
                <div
                  key={bid.id}
                  className={`${COLS} px-4 py-3.5 border-b border-line last:border-b-0 hover:bg-ink-08 transition-colors`}
                >
                  <div className="font-mono text-[12.5px] truncate">{bid.file_name}</div>

                  <div className="text-[12px] text-accent">{bid.doc_type}</div>

                  <div>
                    <div className={`text-[12.5px] font-medium ${riskTextClass(level)}`}>
                      {level}
                    </div>
                    <div className="font-mono text-[11px] text-ink-45 mt-0.5">
                      {(bid.risk_score * 100).toFixed(0)}%
                    </div>
                  </div>

                  <div>
                    {decision ? (
                      <span
                        className={`inline-block border-l-2 pl-2 text-[12px] font-medium ${
                          decision === 'YES'
                            ? 'border-ok text-ok'
                            : decision === 'MANUAL_REVIEW'
                              ? 'border-accent text-accent'
                              : 'border-danger text-danger'
                        }`}
                      >
                        {decision === 'MANUAL_REVIEW' ? 'Review' : decision === 'YES' ? 'Bid' : 'No bid'}
                      </span>
                    ) : (
                      <span className="text-[12px] text-ink-45">—</span>
                    )}
                  </div>

                  <div className="font-mono text-[12.5px]">
                    {decision !== 'YES' ? (
                      <span className="text-ink-45">Not recommended</span>
                    ) : price != null ? (
                      `$${(price as number).toLocaleString()}`
                    ) : (
                      <span className="text-ink-45">—</span>
                    )}
                  </div>

                  <div className="font-mono text-[11.5px] text-ink-45">
                    {formatDate(bid.created_at)}
                  </div>

                  <div className="flex items-center gap-4 text-[12.5px]">
                    <Link href={`/bid/${bid.id}`} className="text-accent hover:underline">
                      View
                    </Link>
                    <button
                      onClick={() => handleDelete(bid)}
                      disabled={deletingId === bid.id}
                      className="text-ink-60 hover:text-danger transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    >
                      {deletingId === bid.id ? 'Removing…' : 'Remove'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <MicroLabel className="mt-4">
        Removing a document also deletes the agent memories learned from it
      </MicroLabel>
    </AppShell>
  );
}
