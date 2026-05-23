import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Upload, FileText, Eye, Download } from "lucide-react";
import { uploadResourceFile } from "@/hooks/useResources";
import { useToast } from "@/hooks/use-toast";

interface EditorProps<T = any> {
  value: T;
  onChange: (v: T) => void;
}

export function LinkEditor({ value, onChange }: EditorProps<{ url?: string }>) {
  return (
    <div className="space-y-2">
      <Label>URL</Label>
      <Input
        type="url"
        placeholder="https://example.com"
        value={value?.url ?? ""}
        onChange={(e) => onChange({ ...value, url: e.target.value })}
      />
    </div>
  );
}

export function RichTextEditor({ value, onChange }: EditorProps<{ markdown?: string }>) {
  return (
    <div className="space-y-2">
      <Label>Notes (Markdown supported)</Label>
      <Textarea
        rows={8}
        value={value?.markdown ?? ""}
        onChange={(e) => onChange({ ...value, markdown: e.target.value })}
        placeholder="Write your notes here. Supports **bold**, *italic*, [links](url), lists..."
      />
    </div>
  );
}

export function FileEditor({ value, onChange }: EditorProps<{ storage_path?: string; file_name?: string; mime_type?: string; size?: number; allow_preview?: boolean; allow_download?: boolean }>) {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const allowPreview = value?.allow_preview ?? true;
  const allowDownload = value?.allow_download ?? true;

  const handleFile = async (f: File) => {
    if (f.size > 50 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 50MB", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const meta = await uploadResourceFile(f);
      onChange({ ...meta, allow_preview: allowPreview, allow_download: allowDownload });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <Label>File</Label>
      {value?.file_name ? (
        <div className="flex items-center gap-2 p-3 border rounded">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1 text-sm">
            <div className="font-medium truncate">{value.file_name}</div>
            <div className="text-xs text-muted-foreground">{((value.size ?? 0) / 1024).toFixed(1)} KB</div>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange({ allow_preview: allowPreview, allow_download: allowDownload })}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <label className="flex items-center justify-center gap-2 p-6 border-2 border-dashed rounded cursor-pointer hover:bg-muted/30">
          <Upload className="h-5 w-5" />
          <span className="text-sm">{uploading ? "Uploading..." : "Click to upload"}</span>
          <input
            type="file"
            className="hidden"
            disabled={uploading}
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </label>
      )}

      <div className="space-y-2 rounded-md border p-3 bg-muted/20">
        <p className="text-xs font-medium text-muted-foreground">Student access controls</p>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="allow-preview" className="flex items-center gap-2 cursor-pointer text-sm font-normal">
            <Eye className="h-4 w-4 text-muted-foreground" />
            Allow in-app preview
          </Label>
          <Switch
            id="allow-preview"
            checked={allowPreview}
            onCheckedChange={(v) => onChange({ ...value, allow_preview: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="allow-download" className="flex items-center gap-2 cursor-pointer text-sm font-normal">
            <Download className="h-4 w-4 text-muted-foreground" />
            Allow file download
          </Label>
          <Switch
            id="allow-download"
            checked={allowDownload}
            onCheckedChange={(v) => onChange({ ...value, allow_download: v })}
          />
        </div>
      </div>
    </div>
  );
}

interface TableContent {
  columns?: { key: string; label: string }[];
  rows?: Record<string, string>[];
}

export function TableEditor({ value, onChange }: EditorProps<TableContent>) {
  const columns = value?.columns ?? [];
  const rows = value?.rows ?? [];

  const addColumn = () => {
    const key = `col_${columns.length + 1}`;
    onChange({ ...value, columns: [...columns, { key, label: `Column ${columns.length + 1}` }] });
  };
  const updateColumnLabel = (i: number, label: string) => {
    const next = [...columns];
    next[i] = { ...next[i], label };
    onChange({ ...value, columns: next });
  };
  const removeColumn = (i: number) => {
    const removedKey = columns[i].key;
    onChange({
      ...value,
      columns: columns.filter((_, idx) => idx !== i),
      rows: rows.map((r) => { const { [removedKey]: _drop, ...rest } = r; return rest; }),
    });
  };
  const addRow = () => onChange({ ...value, rows: [...rows, {}] });
  const updateCell = (rowIdx: number, key: string, val: string) => {
    const next = [...rows];
    next[rowIdx] = { ...next[rowIdx], [key]: val };
    onChange({ ...value, rows: next });
  };
  const removeRow = (i: number) => onChange({ ...value, rows: rows.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Table content</Label>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={addColumn}><Plus className="h-3 w-3 mr-1" />Column</Button>
          <Button type="button" size="sm" variant="outline" onClick={addRow} disabled={columns.length === 0}><Plus className="h-3 w-3 mr-1" />Row</Button>
        </div>
      </div>
      {columns.length === 0 ? (
        <p className="text-sm text-muted-foreground">Add at least one column to start.</p>
      ) : (
        <div className="overflow-auto border rounded">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {columns.map((c, i) => (
                  <th key={c.key} className="p-2 text-left">
                    <div className="flex items-center gap-1">
                      <Input value={c.label} onChange={(e) => updateColumnLabel(i, e.target.value)} className="h-7" />
                      <Button type="button" size="sm" variant="ghost" onClick={() => removeColumn(i)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </th>
                ))}
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="border-t">
                  {columns.map((c) => (
                    <td key={c.key} className="p-1">
                      <Input value={r[c.key] ?? ""} onChange={(e) => updateCell(ri, c.key, e.target.value)} className="h-8" />
                    </td>
                  ))}
                  <td className="p-1">
                    <Button type="button" size="sm" variant="ghost" onClick={() => removeRow(ri)}><Trash2 className="h-3 w-3" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
