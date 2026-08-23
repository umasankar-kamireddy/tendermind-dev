'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ResultsView from '@/components/ResultsView';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/lib/auth';
import { Btn, MicroLabel, RuledNote, StatTile, StatTileGrid, riskTone } from '@/components/ui';

interface BidDetail {
  id: string;
  file_name: string;
  doc_type: string;
  extracted_text: string;
  classification_confidence: number;
  legal_assessment: Record<string, unknown>;
  engineering_assessment: Record<string, unknown>;
  accounting_assessment: Record<string, unknown>;
  risk_score: number;
  risk_factors: Record<string, unknown>;
  recommendation: Record<string, unknown>;
  created_at: string;
}

export default function BidDetailPage() {
  const { token, isLoading: authLoading } = useAuth();
  const params = useParams();
  const bidId = params?.id as string;
  const [bid, setBid] = useState<BidDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // /api/bid/{id} is authenticated; this fetch previously sent no header
    // and so 401'd for every bid, which surfaced as "Bid not found". Wait
    // for the stored session before asking.
    if (!bidId || authLoading) return;

    let cancelled = false;

    const fetchBid = async () => {
      try {
        const response = await fetch(`/api/bid/${bidId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (response.status === 401) throw new Error('Your session has expired - sign in again.');
        if (!response.ok) throw new Error('Bid not found');
        const data = await response.json();
        if (!cancelled) setBid(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchBid();
    return () => {
      cancelled = true;
    };
  }, [bidId, token, authLoading]);

  if (isLoading) {
    return (
      <AppShell title="Bid details">
        <div className="border border-line px-4 py-16 text-center">
          <div className="font-mono text-[12px] text-ink-45">Loading bid details…</div>
        </div>
      </AppShell>
    );
  }

  if (error || !bid) {
    return (
      <AppShell title="Bid details">
        <RuledNote tone="danger">{error || 'Bid not found'}</RuledNote>
        <div className="flex items-center gap-3 mt-6">
          <Btn href="/bids" variant="outline">
            Bid history
          </Btn>
          <Btn href="/" variant="outline">
            New analysis
          </Btn>
        </div>
      </AppShell>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <AppShell
      title="Bid details"
      subtitle={bid.file_name}
      actions={
        <Btn href="/bids" variant="outline">
          Bid history
        </Btn>
      }
    >
      <div>
        {/* Metadata */}
        <StatTileGrid cols={4} className="mb-10">
          <StatTile label="Document type" value={bid.doc_type} mono={false} />
          <StatTile
            label="Classification confidence"
            value={`${(bid.classification_confidence * 100).toFixed(0)}%`}
          />
          <StatTile
            label="Risk score"
            value={`${(bid.risk_score * 100).toFixed(0)}%`}
            tone={riskTone(
              bid.risk_score < 0.33 ? 'LOW' : bid.risk_score < 0.67 ? 'MEDIUM' : 'HIGH',
            )}
          />
          <StatTile label="Uploaded" value={formatDate(bid.created_at)} mono={false} />
        </StatTileGrid>

        {/* Main Results View */}
        <ResultsView
          result={{
            id: bid.id,
            fileName: bid.file_name,
            classification: {
              doc_type: bid.doc_type,
              confidence: bid.classification_confidence,
            },
            legalAssessment: bid.legal_assessment,
            engineeringAssessment: bid.engineering_assessment,
            accountingAssessment: bid.accounting_assessment,
            riskAssessment: {
              risk_score: bid.risk_score,
              ...bid.risk_factors,
            },
            bidRecommendation: bid.recommendation,
          }}
        />

        {/* Extracted Text Preview */}
        <section className="mt-14">
          <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3 mb-4">
            <h2 className="text-[19px] font-semibold tracking-[-0.02em]">Extracted text</h2>
            <span className="font-mono text-[12px] text-ink-60">
              {bid.extracted_text.length.toLocaleString()} characters
            </span>
          </div>
          <div className="border border-line bg-panel px-4 py-4 max-h-96 overflow-y-auto">
            <p className="text-[12.5px] leading-[1.7] text-ink-72 whitespace-pre-wrap font-mono">
              {bid.extracted_text.substring(0, 2000)}
              {bid.extracted_text.length > 2000 && '…'}
            </p>
          </div>
          {bid.extracted_text.length > 2000 ? (
            <MicroLabel className="mt-3">First 2,000 characters shown</MicroLabel>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
