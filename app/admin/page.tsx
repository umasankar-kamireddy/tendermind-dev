'use client';
import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/lib/auth';
interface BoqItem {
  key: string;
  name: string;
  item_type: 'measured' | 'lump_sum';
  quantity: number | null;
  unit: string | null;
  unit_rate: number | null;
  lump_sum_amount: number | null;
}
interface BoqItemWithAmount extends BoqItem {
  amount: number;
}
interface BoqSummary {
  items: BoqItemWithAmount[];
  measured_cost: number;
  lump_sum_cost: number;
  contingency_percentage: number;
  contingency_amount: number;
  total_estimated_cost: number;
}
function computeSummary(items: BoqItem[], contingencyPercentage: number): BoqSummary {
  const withAmounts: BoqItemWithAmount[] = items.map((item) => ({
    ...item,
    amount:
      item.item_type === 'lump_sum'
        ? item.lump_sum_amount || 0
        : (item.quantity || 0) * (item.unit_rate || 0),
  }));
  const measured_cost = withAmounts
    .filter((item) => item.item_type === 'measured')
    .reduce((sum, item) => sum + item.amount, 0);
  const lump_sum_cost = withAmounts
    .filter((item) => item.item_type === 'lump_sum')
    .reduce((sum, item) => sum + item.amount, 0);
  const base_cost = measured_cost + lump_sum_cost;
  const contingency_amount = base_cost * contingencyPercentage;
  return {
    items: withAmounts,
    measured_cost,
    lump_sum_cost,
    contingency_percentage: contingencyPercentage,
    contingency_amount,
    total_estimated_cost: base_cost + contingency_amount,
  };
}
const CONTINGENCY_PERCENTAGE = 0.1;
export default function AdminBoqPage() {
  const { token, isLoading: authLoading } = useAuth();
  const [items, setItems] = useState<BoqItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  useEffect(() => {
    // Admin endpoints are authenticated - fetching before the stored session
    // is restored (or with no header at all) 401s and leaves the page blank.
    if (authLoading) return;
    const fetchDefaults = async () => {
      try {
        const response = await fetch('/api/admin/boq', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) throw new Error('Failed to load BOQ defaults');
        const data = await response.json();
        setItems(data.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };
    fetchDefaults();
  }, [token, authLoading]);
  const updateItem = (key: string, field: keyof BoqItem, value: string) => {
    setItems((prev) =>
      prev
        ? prev.map((item) =>
            item.key === key
              ? {
                  ...item,
                  [field]: field === 'unit' ? value : value === '' ? null : Number(value),
                }
              : item,
          )
        : prev,
    );
  };
  const handleSave = async () => {
    if (!items) return;
    setIsSaving(true);
    setError(null);
    setSavedMessage(null);
    try {
      const response = await fetch('/api/admin/boq', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ items }),
      });
      if (!response.ok) throw new Error('Failed to save BOQ defaults');
      setSavedMessage('Default values saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSaving(false);
    }
  };
  const summary = items ? computeSummary(items, CONTINGENCY_PERCENTAGE) : null;
  return (
    <AppShell
      title="Default Cost Items"
      subtitle="Set default BOQ quantities and rates used for accounting calculations"
      requireAdmin
    >
      <div className="max-w-5xl space-y-6">
        {isLoading ? (
          <div className="border border-line px-4 py-16 text-center">
            <div className="font-mono text-[12px] text-ink-45">Loading defaults…</div>
          </div>
        ) : items ? (
          <>
            <div className="border border-line">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-panel border-b border-line">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-ink">
                        Item
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-ink">
                        Rate / Lump Sum
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.key} className="border-b border-line">
                        <td className="px-6 py-4 text-sm font-medium text-ink">
                          {item.name}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center gap-1">
                            <span className="text-ink-45">$</span>
                            <input
                              type="number"
                              value={
                                item.item_type === 'lump_sum'
                                  ? item.lump_sum_amount ?? ''
                                  : item.unit_rate ?? ''
                              }
                              onChange={(e) =>
                                updateItem(
                                  item.key,
                                  item.item_type === 'lump_sum'
                                    ? 'lump_sum_amount'
                                    : 'unit_rate',
                                  e.target.value,
                                )
                              }
                              className="w-28 px-2 py-1 border border-line bg-panel text-ink"
                            />
                            {item.item_type === 'measured' && item.unit && (
                              <span className="text-ink-45 text-xs">
                                /{item.unit}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-6 border-t border-line flex items-center justify-between">
                <div>
                  {error && <p className="text-danger text-sm">{error}</p>}
                  {savedMessage && (
                    <p className="text-ok text-sm">{savedMessage}</p>
                  )}
                </div>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-6 py-2 bg-accent text-cream hover:bg-ink transition-colors disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Defaults'}
                </button>
              </div>
            </div>
            {summary && (
              <div className="border border-line p-6">
                <h2 className="text-xl font-bold text-ink mb-4">
                  Calculated Accounting Estimate
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-panel">
                    <p className="text-sm text-ink-60">Measured Items</p>
                    <p className="font-semibold text-lg">
                      ${summary.measured_cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                  <div className="p-4 bg-panel">
                    <p className="text-sm text-ink-60">Lump Sum Items</p>
                    <p className="font-semibold text-lg">
                      ${summary.lump_sum_cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                  <div className="p-4 bg-panel">
                    <p className="text-sm text-ink-60">
                      Contingency ({(summary.contingency_percentage * 100).toFixed(0)}%)
                    </p>
                    <p className="font-semibold text-lg">
                      ${summary.contingency_amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                  <div className="p-4 bg-panel">
                    <p className="text-sm text-ink-60">Total Estimated Cost</p>
                    <p className="font-semibold text-lg">
                      ${summary.total_estimated_cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
                <p className="text-ink-45 text-xs mt-4">
                  This estimate is used as the accounting baseline for new document analyses
                  whenever the document itself doesn&apos;t specify enough cost detail.
                </p>
              </div>
            )}
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
