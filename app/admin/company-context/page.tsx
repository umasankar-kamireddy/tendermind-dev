'use client';
import { useEffect, useRef, useState } from 'react';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/lib/auth';
interface ContextItem {
  id: string;
  category: string;
  title: string;
  content: string;
  source_type: 'text' | 'markdown' | 'pdf';
  file_name: string | null;
  created_at: string;
}
const CATEGORY_LABELS: Record<string, string> = {
  legal: 'Legal',
  engineering: 'Engineering',
  accounting: 'Accounting',
  risk: 'Risk',
};
const CATEGORIES = ['legal', 'engineering', 'accounting', 'risk'];
export default function CompanyContextPage() {
  const { token, isLoading: authLoading } = useAuth();
  const [items, setItems] = useState<ContextItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [inputMode, setInputMode] = useState<'text' | 'file'>('text');
  const [isSaving, setIsSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fetchItems = async () => {
    try {
      const response = await fetch('/api/company-context', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Failed to load company context');
      const data = await response.json();
      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    // Admin endpoints are authenticated - see app/admin/page.tsx.
    if (!authLoading) fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, authLoading]);
  const resetForm = () => {
    setTitle('');
    setContent('');
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSavedMessage(null);
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    if (inputMode === 'text' && !content.trim()) {
      setError('Enter some content, or switch to file upload.');
      return;
    }
    if (inputMode === 'file' && !file) {
      setError('Choose a file to upload, or switch to pasted text.');
      return;
    }
    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      if (inputMode === 'text') {
        formData.append('content', content);
      } else if (file) {
        formData.append('file', file);
      }
      const response = await fetch('/api/company-context', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save company context');
      }
      resetForm();
      const detectedLabel = CATEGORY_LABELS[data.category] || data.category;
      setSavedMessage(
        `Saved under category "${detectedLabel}" (auto-detected) - it will be applied to every new analysis for that category.`,
      );
      fetchItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSaving(false);
    }
  };
  const handleDelete = async (item: ContextItem) => {
    if (!confirm(`Remove "${item.title}"? This can't be undone.`)) return;
    try {
      const response = await fetch(`/api/company-context/${item.id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Failed to delete');
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete company context');
    }
  };
  return (
    <AppShell
      title="Company Context"
      subtitle="Reference material injected into every analysis - category is detected automatically"
      requireAdmin
    >
      <div className="max-w-5xl space-y-6">
        <form
          onSubmit={handleSubmit}
          className="border border-line p-6 space-y-4"
        >
          <h2 className="text-lg font-bold text-ink">Add Context</h2>
          <div>
            <label className="block text-xs font-medium text-ink-60 mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Standard liability clause policy"
              className="w-full px-3 py-2 border border-line text-sm bg-panel text-ink placeholder:text-ink-45"
            />
            <p className="text-xs text-ink-45 mt-1">
              Category (Legal / Engineering / Accounting / Risk) is detected automatically from the
              content - no need to pick one.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setInputMode('text')}
              className={`px-3 py-1.5  text-sm font-medium transition-colors ${
                inputMode === 'text'
                  ? 'bg-accent text-cream'
                  : 'bg-panel2 text-ink-72'
              }`}
            >
              Paste text / Markdown
            </button>
            <button
              type="button"
              onClick={() => setInputMode('file')}
              className={`px-3 py-1.5  text-sm font-medium transition-colors ${
                inputMode === 'file'
                  ? 'bg-accent text-cream'
                  : 'bg-panel2 text-ink-72'
              }`}
            >
              Upload .md/.txt/.pdf file
            </button>
          </div>
          {inputMode === 'text' ? (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              placeholder="Paste the reference content here (plain text or Markdown)..."
              className="w-full px-3 py-2 border border-line text-sm bg-panel text-ink placeholder:text-ink-45 font-mono"
            />
          ) : (
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.md,.txt"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-ink-60 file:mr-4 file:py-2 file:px-4 file:border file:border-line file:bg-panel2 file:text-ink file:text-[12.5px] file:font-medium"
            />
          )}
          {error && <p className="text-danger text-sm">{error}</p>}
          {savedMessage && <p className="text-ok text-sm">{savedMessage}</p>}
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2 bg-accent text-cream hover:bg-ink transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Add Context'}
          </button>
        </form>
        {isLoading ? (
          <div className="border border-line px-4 py-16 text-center">
            <div className="font-mono text-[12px] text-ink-45">Loading company context…</div>
          </div>
        ) : (
          <div className="space-y-6">
            {CATEGORIES.map((cat) => {
              const catItems = items.filter((i) => i.category === cat);
              if (catItems.length === 0) return null;
              return (
                <div key={cat} className="border border-line overflow-hidden">
                  <div className="px-6 py-4 border-b border-line">
                    <h3 className="font-semibold text-ink">
                      {CATEGORY_LABELS[cat]}{' '}
                      <span className="text-ink-45 font-normal text-sm">
                        ({catItems.length})
                      </span>
                    </h3>
                  </div>
                  <div className="divide-y divide-line">
                    {catItems.map((item) => (
                      <div key={item.id} className="px-6 py-4 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-medium text-ink">{item.title}</p>
                          <p className="text-xs text-ink-45 mt-0.5">
                            {item.source_type}
                            {item.file_name ? ` - ${item.file_name}` : ''} - added{' '}
                            {new Date(item.created_at).toLocaleDateString()}
                          </p>
                          <p className="text-sm text-ink-60 mt-2 line-clamp-2">
                            {item.content.slice(0, 200)}
                            {item.content.length > 200 ? '...' : ''}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDelete(item)}
                          className="text-danger hover:underline text-sm shrink-0"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {items.length === 0 && (
              <div className="border border-line p-12 text-center text-ink-45">
                No company context uploaded yet. Add reference material above so every future
                analysis has it available.
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
