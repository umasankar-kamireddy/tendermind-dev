'use client';

import { ReactNode, useState } from 'react';
import { MicroLabel, RuledNote, StatTile, StatTileGrid, riskTextClass, riskTone } from '@/components/ui';

interface AgentResult {
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

interface ResultsViewProps {
  result: AgentResult;
}

type TabId = 'overview' | 'legal' | 'engineering' | 'accounting' | 'risk' | 'bid' | 'summary';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'legal', label: 'Legal' },
  { id: 'engineering', label: 'Engineering' },
  { id: 'accounting', label: 'Accounting' },
  { id: 'risk', label: 'Risk' },
  { id: 'bid', label: 'Bid recommendation' },
  { id: 'summary', label: 'Summary' },
];

/** Section heading with the hairline rule used across the workspace. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8 first:mt-0">
      <h3 className="text-[15px] font-semibold tracking-[-0.01em] border-b border-line pb-2.5 mb-3.5">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** Findings read as a ruled list rather than bullets - matches the register views. */
function FindingList({ items }: { items: string[] }) {
  return (
    <ul className="border-t border-line">
      {items.map((item, idx) => (
        <li
          key={idx}
          className="text-[13.5px] leading-[1.65] text-ink-72 py-2.5 border-b border-line"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

function Prose({ children }: { children: ReactNode }) {
  return <p className="text-[13.5px] leading-[1.7] text-ink-72">{children}</p>;
}

export default function ResultsView({ result }: ResultsViewProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const money = (v: unknown) => `$${Number(v || 0).toLocaleString()}`;

  return (
    <div className="w-full border border-line">
      {/* Tab Navigation */}
      <div className="border-b border-line bg-panel">
        <div className="flex overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-[12.5px] font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-ink-60 hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="px-6 py-6">
        {activeTab === 'overview' && (
          <div>
            <div className="grid gap-6 sm:grid-cols-2 mb-8">
              <div>
                <div className="text-[11px] text-ink-60">File name</div>
                <div className="font-mono text-[13px] mt-1.5 truncate">{result.fileName}</div>
              </div>
              <div>
                <div className="text-[11px] text-ink-60">Document type</div>
                <div className="flex items-baseline gap-2.5 mt-1.5">
                  <span className="text-[13px] font-semibold">
                    {result.classification.doc_type}
                  </span>
                  <span className="font-mono text-[11.5px] text-accent">
                    {(result.classification.confidence * 100).toFixed(0)}% confidence
                  </span>
                </div>
              </div>
            </div>

            <StatTileGrid cols={3}>
              <StatTile
                label="Risk level"
                value={(result.riskAssessment?.risk_level as string) || '—'}
                tone={riskTone(result.riskAssessment?.risk_level as string)}
                mono={false}
              />
              <StatTile
                label="Risk score"
                value={
                  result.riskAssessment?.risk_score == null
                    ? '—'
                    : `${(Number(result.riskAssessment.risk_score) * 100).toFixed(0)}%`
                }
              />
              <StatTile
                label="Overall confidence"
                value={
                  result.bidRecommendation?.confidence_score == null
                    ? '—'
                    : `${(Number(result.bidRecommendation.confidence_score) * 100).toFixed(0)}%`
                }
              />
            </StatTileGrid>

            {result.bidRecommendation?.agent_timings_ms ? (
              <Section title="Agent run times">
                {(() => {
                  const timings = result.bidRecommendation.agent_timings_ms as {
                    legal_ms: number;
                    engineering_ms: number;
                    accounting_ms: number;
                    risk_ms: number;
                    agents_wall_clock_ms: number;
                  };
                  const rows: Array<[string, number]> = [
                    ['Legal', timings.legal_ms],
                    ['Engineering', timings.engineering_ms],
                    ['Accounting', timings.accounting_ms],
                    ['Risk', timings.risk_ms],
                  ];
                  return (
                    <>
                      <StatTileGrid cols={4}>
                        {rows.map(([label, ms]) => (
                          <StatTile
                            key={label}
                            label={label}
                            value={ms == null ? '—' : `${(ms / 1000).toFixed(1)}s`}
                          />
                        ))}
                      </StatTileGrid>
                      <MicroLabel className="mt-3">
                        Legal, engineering and accounting run concurrently — wall clock is roughly
                        the slowest of the three ({((timings.agents_wall_clock_ms || 0) / 1000).toFixed(1)}s)
                        plus risk aggregation, not the sum of all four
                      </MicroLabel>
                    </>
                  );
                })()}
              </Section>
            ) : null}
          </div>
        )}

        {activeTab === 'legal' && (
          <div>
            <Section title="Assessment">
              <Prose>{String(result.legalAssessment?.overall_assessment || 'No data')}</Prose>
            </Section>

            {Array.isArray(result.legalAssessment?.compliance_issues) ? (
              <Section title="Compliance issues">
                <FindingList items={result.legalAssessment.compliance_issues as string[]} />
              </Section>
            ) : null}

            {Array.isArray(result.legalAssessment?.risks) ? (
              <Section title="Legal risks">
                <FindingList items={result.legalAssessment.risks as string[]} />
              </Section>
            ) : null}
          </div>
        )}

        {activeTab === 'engineering' && (
          <div>
            <Section title="Feasibility">
              <Prose>{String(result.engineeringAssessment?.feasibility || 'No data')}</Prose>
            </Section>

            {result.engineeringAssessment?.timeline_estimate ? (
              <Section title="Timeline estimate">
                <Prose>{String(result.engineeringAssessment.timeline_estimate)}</Prose>
              </Section>
            ) : null}

            {Array.isArray(result.engineeringAssessment?.structural_concerns) ? (
              <Section title="Structural concerns">
                <FindingList items={result.engineeringAssessment.structural_concerns as string[]} />
              </Section>
            ) : null}
          </div>
        )}

        {activeTab === 'accounting' && (
          <div>
            <StatTileGrid cols={3}>
              <StatTile
                label="Material costs"
                value={money(result.accountingAssessment?.material_costs)}
              />
              <StatTile
                label="Labour costs"
                value={money(result.accountingAssessment?.labor_costs)}
              />
              <StatTile
                label="Contingency"
                value={`${Number(result.accountingAssessment?.contingency_percentage || 0).toFixed(0)}%`}
              />
            </StatTileGrid>

            <div className="border border-line border-t-0 bg-panel px-5 py-4">
              <div className="text-[11px] text-ink-60">Total estimated cost</div>
              <div className="font-mono text-[32px] leading-tight mt-1.5 text-accent">
                {money(result.accountingAssessment?.total_estimated_cost)}
              </div>
            </div>

            {/*
              Counterparty screening is a deterministic watchlist lookup, not an
              LLM opinion, and it can hard-override the bid decision - so it is
              surfaced here rather than left buried in the raw payload.
            */}
            {result.accountingAssessment?.counterparty_verification ? (
              <Section title="Counterparty screening">
                {(() => {
                  const cv = result.accountingAssessment.counterparty_verification as {
                    status?: string;
                    entity_name?: string;
                    debarred?: boolean;
                    summary?: string;
                  };
                  const tone =
                    cv.debarred || cv.status === 'flagged'
                      ? 'danger'
                      : cv.status === 'verified'
                        ? 'line'
                        : 'accent';
                  return (
                    <>
                      <div className="flex items-baseline gap-3 mb-3">
                        <span className="font-mono text-[13px]">{cv.entity_name || '—'}</span>
                        <span
                          className={`text-[12px] font-medium ${
                            tone === 'danger'
                              ? 'text-danger'
                              : tone === 'line'
                                ? 'text-ok'
                                : 'text-accent'
                          }`}
                        >
                          {cv.debarred ? 'Debarred' : (cv.status || 'unknown')}
                        </span>
                      </div>
                      <RuledNote tone={tone}>{cv.summary || 'No detail returned.'}</RuledNote>
                    </>
                  );
                })()}
              </Section>
            ) : null}

            {Array.isArray(result.accountingAssessment?.boq_breakdown) ? (
              <Section title="Default cost item breakdown">
                <div className="border border-line overflow-x-auto">
                  <table className="w-full text-[12.5px] min-w-[560px]">
                    <thead>
                      <tr className="bg-panel border-b border-line">
                        <th className="micro text-left px-4 py-2.5">Item</th>
                        <th className="micro text-left px-4 py-2.5">Quantity</th>
                        <th className="micro text-left px-4 py-2.5">Rate</th>
                        <th className="micro text-right px-4 py-2.5">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        result.accountingAssessment.boq_breakdown as Array<{
                          name: string;
                          item_type: string;
                          quantity: number | null;
                          unit: string | null;
                          unit_rate: number | null;
                          lump_sum_amount: number | null;
                          amount: number;
                        }>
                      ).map((item, idx) => (
                        <tr key={idx} className="border-b border-line last:border-b-0">
                          <td className="px-4 py-2.5">{item.name}</td>
                          <td className="px-4 py-2.5 font-mono text-ink-60">
                            {item.item_type === 'measured'
                              ? `${item.quantity} ${item.unit}`
                              : 'Lump sum'}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-ink-60">
                            {item.item_type === 'measured'
                              ? `$${Number(item.unit_rate).toLocaleString()}/${item.unit}`
                              : '—'}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-right">
                            ${item.amount.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            ) : null}
          </div>
        )}

        {activeTab === 'risk' && (
          <div>
            <StatTileGrid cols={2}>
              <StatTile
                label="Risk level"
                value={String(result.riskAssessment?.risk_level || '—')}
                tone={riskTone(result.riskAssessment?.risk_level as string)}
                mono={false}
              />
              <StatTile
                label="Risk score"
                value={`${(((result.riskAssessment?.risk_score as number) || 0) * 100).toFixed(0)}%`}
                tone={riskTone(result.riskAssessment?.risk_level as string)}
              />
            </StatTileGrid>

            {Array.isArray(result.riskAssessment?.risk_factors) ? (
              <Section title="Risk factors">
                <FindingList items={result.riskAssessment.risk_factors as string[]} />
              </Section>
            ) : null}

            {Array.isArray(result.riskAssessment?.mitigation_strategies) ? (
              <Section title="Mitigation strategies">
                <FindingList items={result.riskAssessment.mitigation_strategies as string[]} />
              </Section>
            ) : null}
          </div>
        )}

        {activeTab === 'bid' && (
          <div>
            {(() => {
              const decision = String(result.bidRecommendation?.bid_decision || '').toUpperCase();
              const isYes = decision === 'YES';
              const needsManualReview = decision === 'MANUAL_REVIEW';

              if (needsManualReview) {
                return (
                  <div className="border border-line bg-panel px-6 py-6">
                    <MicroLabel>Pricing</MicroLabel>
                    <div className="text-[24px] font-semibold tracking-[-0.02em] text-accent mt-2">
                      Manual review required
                    </div>
                    <p className="text-[13px] leading-[1.7] text-ink-60 mt-3 max-w-[60ch]">
                      No bid price is suggested — part of the automated analysis failed, so a
                      price based on an incomplete assessment would be misleading.
                    </p>
                    {result.bidRecommendation?.pricing_strategy_rationale ? (
                      <div className="mt-5">
                        <RuledNote tone="accent">
                          {String(result.bidRecommendation.pricing_strategy_rationale)}
                        </RuledNote>
                      </div>
                    ) : null}
                  </div>
                );
              }

              return (
                <div className="border border-line bg-panel px-6 py-6">
                  <MicroLabel>
                    {isYes ? 'Recommended bid price' : 'Reference price — bid not recommended'}
                  </MicroLabel>
                  <div
                    className={`font-mono text-[40px] leading-tight mt-2 ${
                      isYes ? 'text-accent' : 'text-ink-45'
                    }`}
                  >
                    {money(result.bidRecommendation?.recommended_bid_price)}
                  </div>

                  <div className="grid gap-px bg-line border border-line mt-6 sm:grid-cols-2">
                    <div className="bg-panel px-4 py-3.5">
                      <div className="text-[11px] text-ink-60">Total project cost</div>
                      <div className="font-mono text-[15px] mt-1.5">
                        {money(result.bidRecommendation?.estimated_cost)}
                      </div>
                    </div>
                    <div className="bg-panel px-4 py-3.5">
                      <div className="text-[11px] text-ink-60">Margin</div>
                      <div className="font-mono text-[15px] mt-1.5">
                        {Number(result.bidRecommendation?.bid_margin_percentage || 0).toFixed(0)}%
                        {result.bidRecommendation?.profit_amount != null ? (
                          <span className="text-ink-45">
                            {' '}
                            · {money(result.bidRecommendation.profit_amount)} profit
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {result.bidRecommendation?.pricing_strategy_rationale ? (
                    <div className="mt-5">
                      <RuledNote>
                        {String(result.bidRecommendation.pricing_strategy_rationale)}
                      </RuledNote>
                    </div>
                  ) : null}
                </div>
              );
            })()}

            <Section title="Recommendation">
              <Prose>{String(result.bidRecommendation?.recommendation || 'No data')}</Prose>
            </Section>

            {result.bidRecommendation?.confidence_score != null && (
              <Section title="Overall confidence">
                <div className="h-1.5 bg-ink-08">
                  <div
                    className="bg-accent h-1.5"
                    style={{
                      width: `${Number(result.bidRecommendation.confidence_score) * 100}%`,
                    }}
                  />
                </div>
                <div className="font-mono text-[12.5px] mt-2.5">
                  {(Number(result.bidRecommendation.confidence_score) * 100).toFixed(0)}%
                </div>
              </Section>
            )}
          </div>
        )}

        {activeTab === 'summary' && (
          <div>
            {(() => {
              const decision = String(result.riskAssessment?.bid_decision || '').toUpperCase();
              const needsManualReview = decision === 'MANUAL_REVIEW';
              const riskScore = result.riskAssessment?.risk_score;
              const level = String(result.riskAssessment?.risk_level || '—');
              const toneClass =
                decision === 'YES'
                  ? 'text-ok'
                  : needsManualReview
                    ? 'text-accent'
                    : 'text-danger';

              return (
                <div className="border border-line bg-panel px-6 py-10 text-center">
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
                      ? 'Part of the automated analysis failed — no automated bid decision was made.'
                      : `Based on ${level} risk (${(Number(riskScore || 0) * 100).toFixed(0)}% risk score)`}
                  </p>
                  {!needsManualReview ? (
                    <div className={`text-[12.5px] font-medium mt-1.5 ${riskTextClass(level)}`}>
                      {level} risk
                    </div>
                  ) : null}
                </div>
              );
            })()}

            <Section title="Contract summary">
              <Prose>
                {String(result.riskAssessment?.contract_summary || 'No summary available.')}
              </Prose>
            </Section>

            {result.riskAssessment?.recommendation_rationale ? (
              <Section title="Why">
                <Prose>{String(result.riskAssessment.recommendation_rationale)}</Prose>
              </Section>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
