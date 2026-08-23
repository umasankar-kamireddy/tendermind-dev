'use client';

import { useEffect, useRef, useState } from 'react';
import UploadForm from '@/components/UploadForm';
import ResultsView from '@/components/ResultsView';
import ProcessProgress, { ProcessStage } from '@/components/ProcessProgress';
import AppShell from '@/components/AppShell';
import StatCard from '@/components/StatCard';
import { Btn, MicroLabel, RuledNote, StatTileGrid, riskTextClass } from '@/components/ui';
import { useAuth } from '@/lib/auth';

interface DashboardStats {
  total: number;
  recommendedPercent: number;
  avgRiskPercent: number;
}

interface AnalysisResult {
  id: string;
  fileName: string;
  classification: {
    doc_type: string;
    confidence: number;
  };
  legalAssessment: Record<string, unknown>;
  engineeringAssessment: Record<string, unknown>;
  accountingAssessment: Record<string, unknown>;
  riskAssessment: Record<string, unknown>;
  bidRecommendation: Record<string, unknown>;
}

export default function Home() {
  const { token } = useAuth();
  const [stage, setStage] = useState<ProcessStage | null>(null);
  const [progress, setProgress] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(
    null,
  );
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const analyzeProgressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  const isProcessing = stage === 'uploading' || stage === 'analyzing';

  useEffect(() => {
    return () => {
      if (analyzeProgressTimer.current) clearInterval(analyzeProgressTimer.current);
    };
  }, []);

  const refreshStats = async () => {
    try {
      const response = await fetch('/api/bids?limit=100');
      if (!response.ok) return;
      const data = await response.json();
      const bids: Array<{ risk_score?: number; risk_factors?: { bid_decision?: string } }> =
        data.bids || [];
      if (bids.length === 0) {
        setStats({ total: 0, recommendedPercent: 0, avgRiskPercent: 0 });
        return;
      }
      const yesCount = bids.filter(
        (b) => String(b.risk_factors?.bid_decision || '').toUpperCase() === 'YES',
      ).length;
      const scored = bids.filter((b) => typeof b.risk_score === 'number');
      const avgRisk = scored.length
        ? scored.reduce((sum, b) => sum + (b.risk_score || 0), 0) / scored.length
        : 0;
      setStats({
        total: bids.length,
        recommendedPercent: Math.round((yesCount / bids.length) * 100),
        avgRiskPercent: Math.round(avgRisk * 100),
      });
    } catch {
      // Stats are a nice-to-have dashboard summary, not required for the
      // page to function - a fetch failure just leaves the row hidden.
    }
  };

  useEffect(() => {
    refreshStats();
  }, []);

  const handleUploadStart = (file: File) => {
    setUploadedFileName(file.name);
    setUploadedFile(file);
    setExtractedText(null);
    setAnalysisResult(null);
    setError(null);
    setStage('uploading');
    setProgress(0);
  };

  const handleUploadSuccess = async (data: {
    fileName: string;
    extractedText: string;
    file: File;
  }) => {
    setUploadedFileName(data.fileName);
    setUploadedFile(data.file);
    setExtractedText(data.extractedText);
    setStage('analyzing');

    // The analyze call has no server-sent progress, so ease the bar toward
    // (not to) 90% while it's in flight - the remaining jump to 100% only
    // happens once the real response lands, so the bar never lies about
    // completion.
    setProgress(5);
    analyzeProgressTimer.current = setInterval(() => {
      setProgress((p) => (p >= 90 ? p : p + (90 - p) * 0.1));
    }, 400);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          fileName: data.fileName,
          extractedText: data.extractedText,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to analyze document');
      }
      if (analyzeProgressTimer.current) clearInterval(analyzeProgressTimer.current);
      setProgress(100);
      setAnalysisResult(result);
      setStage('done');
      refreshStats();
    } catch (err) {
      if (analyzeProgressTimer.current) clearInterval(analyzeProgressTimer.current);
      setError(
        err instanceof Error ? err.message : 'An error occurred during analysis',
      );
      setAnalysisResult(null);
      setStage(null);
    }
  };

  return (
    <AppShell
      title="Dashboard"
      subtitle="Intelligent document analysis for bid recommendations"
      actions={
        <Btn href="/bids" variant="outline">
          Bid history
        </Btn>
      }
    >
      {stats && (
        <StatTileGrid cols={3} className="mb-10">
          <StatCard label="Bids analysed" value={String(stats.total)} icon="" accent="blue" />
          <StatCard
            label="Recommended to bid"
            value={`${stats.recommendedPercent}%`}
            icon=""
            accent="green"
          />
          <StatCard
            label="Average risk score"
            value={`${stats.avgRiskPercent}%`}
            icon=""
            accent="amber"
          />
        </StatTileGrid>
      )}

      {/* Upload Section */}
      <section>
        <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3 mb-4">
          <h2 className="text-[19px] font-semibold tracking-[-0.02em]">Upload document</h2>
          {(uploadedFileName || analysisResult) && !isProcessing && (
            <button
              onClick={() => {
                setUploadedFileName(null);
                setUploadedFile(null);
                setExtractedText(null);
                setAnalysisResult(null);
                setError(null);
                setStage(null);
                setProgress(0);
              }}
              className="text-[12.5px] text-ink-60 hover:text-accent transition-colors"
            >
              Upload another document
            </button>
          )}
        </div>

        <p className="text-[13.5px] leading-[1.7] text-ink-72 mb-6 max-w-[70ch]">
          Upload a construction document — contract, specification, bill of quantities, drawing or
          addendum — for automatic analysis.
        </p>

        <UploadForm
          onUploadSuccess={handleUploadSuccess}
          onUploadStart={handleUploadStart}
          onUploadProgress={setProgress}
          disabled={isProcessing}
        />

        {uploadedFileName && !isProcessing && stage !== 'done' && (
          <div className="mt-6">
            <RuledNote tone="accent">
              File uploaded: <span className="font-mono">{uploadedFileName}</span>
            </RuledNote>
          </div>
        )}

        {stage && <ProcessProgress stage={stage} percent={progress} />}

        {error && (
          <div className="mt-6">
            <RuledNote tone="danger">{error}</RuledNote>
          </div>
        )}
      </section>

      {/* Capability Section */}
      {!analysisResult && !isProcessing && (
        <section className="mt-14">
          <MicroLabel className="mb-4">What runs on every document</MicroLabel>
          <div className="grid gap-px bg-line border border-line sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['01', 'Document extraction', 'Text pulled from the PDF, section by section.'],
              ['02', 'Classification', 'Contract, specification, BOQ, drawing or addendum.'],
              ['03', 'Multi-agent analysis', 'Legal, engineering and accounting run in parallel.'],
              ['04', 'Bid recommendation', 'Risk-adjusted price and a bid / no-bid decision.'],
            ].map(([step, title, body]) => (
              <div key={step} className="bg-panel px-5 py-5">
                <div className="font-mono text-[11px] text-accent">{step}</div>
                <div className="text-[13.5px] font-semibold mt-2">{title}</div>
                <p className="text-[12.5px] leading-[1.6] text-ink-60 mt-2">{body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Results Section */}
      {analysisResult && (
        <div className="mt-14">
          {/* Bid Decision & Risk Analysis */}
          {(() => {
            const risk = analysisResult.riskAssessment;
            const decision = String(risk?.bid_decision || '').toUpperCase();
            const isYes = decision === 'YES';
            const needsManualReview = decision === 'MANUAL_REVIEW';
            const riskLevel = String(risk?.risk_level || '—');
            const riskScore = risk?.risk_score == null ? null : Number(risk.risk_score);
            const riskFactors = Array.isArray(risk?.risk_factors)
              ? (risk.risk_factors as string[])
              : [];
            const mitigations = Array.isArray(risk?.mitigation_strategies)
              ? (risk.mitigation_strategies as string[])
              : [];
            const bid = analysisResult.bidRecommendation;
            const recommendedBidPrice = Number(bid?.recommended_bid_price || 0);
            const totalProjectCost = Number(bid?.estimated_cost || 0);
            const marginPercentage = Number(bid?.bid_margin_percentage || 0);
            const profitAmount = Number(bid?.profit_amount || 0);
            const toneClass = isYes
              ? 'text-ok'
              : needsManualReview
                ? 'text-accent'
                : 'text-danger';

            return (
              <div className="border border-line">
                <div className="bg-panel px-6 py-10 text-center border-b border-line">
                  <MicroLabel>Recommended to bid?</MicroLabel>
                  <div
                    className={`font-semibold tracking-[-0.03em] mt-3 ${toneClass} ${
                      needsManualReview ? 'text-[28px]' : 'text-[56px] leading-none'
                    }`}
                  >
                    {needsManualReview ? 'Manual review required' : decision || '—'}
                  </div>
                  <p className="text-[13px] text-ink-60 mt-4">
                    {needsManualReview
                      ? 'Part of the automated analysis failed — no bid decision can be made from an incomplete assessment.'
                      : `Based on ${riskLevel} risk (${((riskScore ?? 0) * 100).toFixed(0)}% risk score)`}
                  </p>
                  {!needsManualReview ? (
                    <div className={`text-[12.5px] font-medium mt-1.5 ${riskTextClass(riskLevel)}`}>
                      {riskLevel} risk
                    </div>
                  ) : null}
                  {risk?.recommendation_rationale ? (
                    <p className="text-[13px] leading-[1.7] text-ink-72 mt-5 max-w-[70ch] mx-auto">
                      {String(risk.recommendation_rationale)}
                    </p>
                  ) : null}

                  {isYes && recommendedBidPrice > 0 && (
                    <div className="mt-8 inline-block border border-line-strong px-8 py-5 text-left">
                      <MicroLabel>Recommended bid amount</MicroLabel>
                      <div className="font-mono text-[34px] leading-tight text-accent mt-2">
                        ${recommendedBidPrice.toLocaleString()}
                      </div>
                      <p className="text-[12.5px] text-ink-60 mt-2">
                        Total project cost ${totalProjectCost.toLocaleString()} +{' '}
                        {marginPercentage.toFixed(0)}% margin
                        {profitAmount > 0 && <> · ${profitAmount.toLocaleString()} profit</>}
                      </p>
                      <p className="text-[11.5px] text-ink-45 mt-1.5 max-w-[46ch]">
                        Priced to balance winning chances against profitability at the assessed
                        risk level.
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid gap-px bg-line md:grid-cols-2">
                  <div className="bg-panel px-5 py-5">
                    <MicroLabel className="mb-3">Risk factors</MicroLabel>
                    {riskFactors.length > 0 ? (
                      <ul className="border-t border-line">
                        {riskFactors.map((factor, idx) => (
                          <li
                            key={idx}
                            className="text-[13px] leading-[1.6] text-ink-72 py-2.5 border-b border-line"
                          >
                            {factor}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[13px] text-ink-45">
                        No significant risk factors identified.
                      </p>
                    )}
                  </div>

                  <div className="bg-panel px-5 py-5">
                    <MicroLabel className="mb-3">Mitigation strategies</MicroLabel>
                    {mitigations.length > 0 ? (
                      <ul className="border-t border-line">
                        {mitigations.map((strategy, idx) => (
                          <li
                            key={idx}
                            className="text-[13px] leading-[1.6] text-ink-72 py-2.5 border-b border-line"
                          >
                            {strategy}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[13px] text-ink-45">No mitigation strategies required.</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="mt-10">
            <ResultsView result={analysisResult} />
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-line mt-6 pt-4">
            <div className="font-mono text-[11.5px] text-ink-45">Bid ID {analysisResult.id}</div>
            <Btn href={`/bid/${analysisResult.id}`} variant="outline">
              Full bid details
            </Btn>
          </div>
        </div>
      )}
    </AppShell>
  );
}
