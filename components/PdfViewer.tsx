'use client';
import { useEffect, useState } from 'react';
interface PdfViewerProps {
  file: File | null;
  extractedText?: string;
}
/**
 * Embeds the uploaded PDF (via the browser's native PDF viewer, through an
 * object URL) so the user can see the exact document the agents are
 * analyzing side-by-side with the extracted text that's actually sent to
 * them as context.
 */
export default function PdfViewer({ file, extractedText }: PdfViewerProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [showExtractedText, setShowExtractedText] = useState(false);
  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  if (!file) {
    return null;
  }
  const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
  return (
    <div className="border border-line">
      <div className="px-6 py-4 border-b border-line flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-ink">Source Document</h3>
          <p className="text-sm text-ink-45 font-mono">{file.name}</p>
        </div>
        {extractedText && (
          <button
            onClick={() => setShowExtractedText((v) => !v)}
            className="px-3 py-1.5 text-[12.5px] border border-line hover:bg-ink-08 text-ink-72 transition-colors"
          >
            {showExtractedText ? 'Show PDF' : 'Show extracted text used as context'}
          </button>
        )}
      </div>
      {showExtractedText && extractedText ? (
        <pre className="p-6 h-[600px] overflow-auto whitespace-pre-wrap text-sm text-ink-72 bg-panel">
          {extractedText}
        </pre>
      ) : isPdf && objectUrl ? (
        <iframe
          src={objectUrl}
          title={file.name}
          className="w-full h-[600px] border-0"
        />
      ) : (
        <div className="p-6 h-[600px] flex items-center justify-center text-ink-45 text-sm">
          Preview not available for this file type — the extracted text above is
          still used as the agents&apos; context.
        </div>
      )}
    </div>
  );
}
