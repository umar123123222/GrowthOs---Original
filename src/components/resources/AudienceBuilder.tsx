import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { ResourceAudience } from "@/hooks/useResources";

type AudienceRule = Pick<ResourceAudience, "audience_type" | "target_id">;

interface Props {
  value: AudienceRule[];
  onChange: (rules: AudienceRule[]) => void;
}

export function AudienceBuilder({ value, onChange }: Props) {
  const [pathways, setPathways] = useState<{ id: string; name: string }[]>([]);
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [batches, setBatches] = useState<{ id: string; name: string }[]>([]);
  const [type, setType] = useState<"all" | "pathway" | "course" | "batch">("all");
  const [target, setTarget] = useState<string>("");

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: c }, { data: b }] = await Promise.all([
        supabase.from("learning_pathways").select("id,name").order("name"),
        supabase.from("courses").select("id,title").order("title"),
        supabase.from("batches").select("id,name").order("name"),
      ]);
      setPathways(p ?? []);
      setCourses(c ?? []);
      setBatches(b ?? []);
    })();
  }, []);

  const addRule = () => {
    if (type === "all") {
      if (value.some((r) => r.audience_type === "all")) return;
      onChange([...value, { audience_type: "all", target_id: null }]);
    } else if (target) {
      const exists = value.some((r) => r.audience_type === type && r.target_id === target);
      if (exists) return;
      onChange([...value, { audience_type: type, target_id: target }]);
      setTarget("");
    }
  };

  const removeAt = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  const labelFor = (r: AudienceRule) => {
    if (r.audience_type === "all") return "All active students";
    if (r.audience_type === "pathway") return `Pathway: ${pathways.find((x) => x.id === r.target_id)?.name ?? r.target_id}`;
    if (r.audience_type === "course") return `Course: ${courses.find((x) => x.id === r.target_id)?.title ?? r.target_id}`;
    return `Batch: ${batches.find((x) => x.id === r.target_id)?.name ?? r.target_id}`;
  };

  const targetOptions =
    type === "pathway" ? pathways.map((p) => ({ id: p.id, label: p.name }))
    : type === "course" ? courses.map((c) => ({ id: c.id, label: c.title }))
    : type === "batch" ? batches.map((b) => ({ id: b.id, label: b.name }))
    : [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {value.length === 0 && (
          <p className="text-sm text-muted-foreground">No audience rules — resource will not be visible to any student.</p>
        )}
        {value.map((r, i) => (
          <Badge key={i} variant="secondary" className="gap-1 pr-1">
            {labelFor(r)}
            <button type="button" onClick={() => removeAt(i)} className="ml-1 hover:bg-muted rounded">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={type} onValueChange={(v: any) => { setType(v); setTarget(""); }}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All active students</SelectItem>
            <SelectItem value="pathway">Pathway</SelectItem>
            <SelectItem value="course">Course</SelectItem>
            <SelectItem value="batch">Batch</SelectItem>
          </SelectContent>
        </Select>
        {type !== "all" && (
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger className="w-[260px]"><SelectValue placeholder={`Select ${type}`} /></SelectTrigger>
            <SelectContent>
              {targetOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Button type="button" size="sm" onClick={addRule} disabled={type !== "all" && !target}>
          <Plus className="h-4 w-4 mr-1" /> Add rule
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">A student sees the resource if they match <strong>any</strong> rule above.</p>
    </div>
  );
}
