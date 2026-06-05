import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ExpandableSubDetailsProps {
  /** Optional summary/preview node shown next to the expand toggle when collapsed. */
  preview?: React.ReactNode;
  /** Raw data to pretty-print when expanded. */
  data: unknown;
}

/**
 * Compact sub-details cell with an expand toggle that reveals the full JSON payload
 * on multiple lines below the preview.
 */
export function ExpandableSubDetails({ preview, data }: ExpandableSubDetailsProps) {
  const [expanded, setExpanded] = useState(false);

  let pretty = '';
  try {
    pretty = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  } catch {
    pretty = String(data);
  }

  const compact = (() => {
    try {
      return typeof data === 'string' ? data : JSON.stringify(data);
    } catch {
      return String(data);
    }
  })();

  return (
    <div className="space-y-1 min-w-0">
      <div className="flex items-start gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-5 w-5 shrink-0 -ml-1"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Collapse details' : 'Expand details'}
        >
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </Button>
        <div className="text-xs opacity-70 truncate flex-1 min-w-0">
          {preview ?? compact}
        </div>
      </div>
      {expanded && (
        <pre className="text-[11px] leading-snug bg-muted/50 border rounded p-2 whitespace-pre-wrap break-all max-h-64 overflow-auto">
          {pretty}
        </pre>
      )}
    </div>
  );
}
