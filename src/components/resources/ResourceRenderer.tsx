import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ExternalLink, Download, FileText } from "lucide-react";
import { getResourceFileSignedUrl, type Resource } from "@/hooks/useResources";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function ResourceRenderer({ resource }: { resource: Resource }) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  useEffect(() => {
    if (resource.content_type === "file" && resource.content?.storage_path) {
      getResourceFileSignedUrl(resource.content.storage_path)
        .then(setFileUrl)
        .catch(() => setFileUrl(null));
    }
  }, [resource]);

  if (resource.content_type === "link") {
    const url = resource.content?.url;
    if (!url) return null;
    return (
      <a href={url} target="_blank" rel="noopener noreferrer">
        <Button variant="outline" size="sm" className="gap-2">
          <ExternalLink className="h-4 w-4" />
          Open link
        </Button>
      </a>
    );
  }

  if (resource.content_type === "file") {
    const allowPreview = resource.content?.allow_preview ?? true;
    const allowDownload = resource.content?.allow_download ?? true;
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{resource.content?.file_name}</span>
        {fileUrl && allowPreview && (
          <a href={fileUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="gap-2">
              <FileText className="h-4 w-4" />
              Preview
            </Button>
          </a>
        )}
        {fileUrl && allowDownload && (
          <a href={fileUrl} target="_blank" rel="noopener noreferrer" download={resource.content?.file_name || true}>
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              Download
            </Button>
          </a>
        )}
        {!allowPreview && !allowDownload && (
          <span className="text-xs text-muted-foreground italic">Access restricted</span>
        )}
      </div>
    );
  }

  if (resource.content_type === "rich_text") {
    return (
      <div className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground">
        {resource.content?.markdown ?? ""}
      </div>
    );
  }

  if (resource.content_type === "table") {
    const cols: { key: string; label: string }[] = resource.content?.columns ?? [];
    const rows: Record<string, string>[] = resource.content?.rows ?? [];
    if (cols.length === 0) return null;
    return (
      <div className="overflow-auto rounded border">
        <Table>
          <TableHeader>
            <TableRow>
              {cols.map((c) => <TableHead key={c.key}>{c.label}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                {cols.map((c) => <TableCell key={c.key}>{r[c.key] ?? ""}</TableCell>)}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return null;
}
