import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus, Pencil, Trash2, FolderOpen, Search, Link2, FileUp, AlignLeft, Table2,
  Eye, EyeOff, Users, Layers, BookOpen, GraduationCap, Globe, Sparkles
} from "lucide-react";
import {
  useResourceSections,
  useResources,
  useUpsertSection,
  useDeleteSection,
  useUpsertResource,
  useDeleteResource,
  type Resource,
  type ResourceSection,
  type ResourceContentType,
} from "@/hooks/useResources";
import { AudienceBuilder } from "@/components/resources/AudienceBuilder";
import { LinkEditor, FileEditor, RichTextEditor, TableEditor } from "@/components/resources/ResourceContentEditors";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const TYPE_META: Record<ResourceContentType, { label: string; icon: typeof Link2; color: string }> = {
  link: { label: "Link", icon: Link2, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40" },
  file: { label: "File", icon: FileUp, color: "text-purple-600 bg-purple-50 dark:bg-purple-950/40" },
  rich_text: { label: "Notes", icon: AlignLeft, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40" },
  table: { label: "Table", icon: Table2, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" },
};

const AUDIENCE_META: Record<string, { label: string; icon: typeof Globe }> = {
  all: { label: "All students", icon: Globe },
  pathway: { label: "Pathway", icon: Layers },
  course: { label: "Course", icon: BookOpen },
  batch: { label: "Batch", icon: GraduationCap },
  role: { label: "Role", icon: Users },
};

export default function ResourcesManagement() {
  const { data: sections = [], isLoading: sLoading } = useResourceSections();
  const { data: resources = [], isLoading: rLoading } = useResources();
  const deleteSection = useDeleteSection();
  const deleteResource = useDeleteResource();

  const [sectionDialog, setSectionDialog] = useState<ResourceSection | null | "new">(null);
  const [resourceDialog, setResourceDialog] = useState<{ resource: Resource | null; sectionId?: string } | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ResourceContentType | "all">("all");
  const [showHidden, setShowHidden] = useState(true);

  const grouped = useMemo(() => {
    const map = new Map<string, Resource[]>();
    sections.forEach((s) => map.set(s.id, []));
    resources.forEach((r) => {
      if (!map.has(r.section_id)) map.set(r.section_id, []);
      map.get(r.section_id)!.push(r);
    });
    return map;
  }, [sections, resources]);

  const filteredGrouped = useMemo(() => {
    const term = search.trim().toLowerCase();
    const out = new Map<string, Resource[]>();
    grouped.forEach((items, sid) => {
      out.set(
        sid,
        items.filter((r) => {
          if (!showHidden && !r.is_active) return false;
          if (typeFilter !== "all" && r.content_type !== typeFilter) return false;
          if (term && !r.title.toLowerCase().includes(term) && !(r.description ?? "").toLowerCase().includes(term)) return false;
          return true;
        })
      );
    });
    return out;
  }, [grouped, search, typeFilter, showHidden]);

  const stats = useMemo(() => ({
    sections: sections.length,
    resources: resources.length,
    active: resources.filter((r) => r.is_active).length,
  }), [sections, resources]);

  const visibleSections = useMemo(
    () => (showHidden ? sections : sections.filter((s) => s.is_active)),
    [sections, showHidden]
  );

  const isFiltering = search.trim() !== "" || typeFilter !== "all";

  if (sLoading || rLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
        {/* Hero header */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 md:p-8">
          <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-primary/10 blur-3xl" aria-hidden />
          <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                <Sparkles className="h-3 w-3" /> Student-facing library
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Resources</h1>
              <p className="text-sm text-muted-foreground max-w-xl">
                Curate links, files, notes and tables for your students. Group them into sections and target by pathway, course, batch or role.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StatPill label="Sections" value={stats.sections} />
              <StatPill label="Resources" value={stats.resources} />
              <StatPill label="Active" value={stats.active} accent />
              <Button onClick={() => setSectionDialog("new")} className="shadow-sm">
                <Plus className="h-4 w-4 mr-2" /> New section
              </Button>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        {sections.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search resources by title or description..."
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="link">Links</SelectItem>
                <SelectItem value="file">Files</SelectItem>
                <SelectItem value="rich_text">Notes</SelectItem>
                <SelectItem value="table">Tables</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 px-3 rounded-md border h-10 bg-background">
              <Switch id="show-hidden" checked={showHidden} onCheckedChange={setShowHidden} />
              <Label htmlFor="show-hidden" className="text-sm cursor-pointer flex items-center gap-1.5">
                {showHidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                Show hidden
              </Label>
            </div>
          </div>
        )}

        {/* Sections */}
        {sections.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="No sections yet"
            description="Create your first section to start organizing resources for your students."
            action={
              <Button onClick={() => setSectionDialog("new")}>
                <Plus className="h-4 w-4 mr-2" /> Create first section
              </Button>
            }
          />
        ) : (
          <Accordion type="multiple" defaultValue={visibleSections.map((s) => s.id)} className="space-y-3">
            {visibleSections.map((section) => {
              const items = filteredGrouped.get(section.id) ?? [];
              const totalInSection = grouped.get(section.id)?.length ?? 0;
              return (
                <AccordionItem
                  key={section.id}
                  value={section.id}
                  className={cn(
                    "border rounded-xl bg-card overflow-hidden",
                    !section.is_active && "opacity-70"
                  )}
                >
                  <div className="flex items-center pr-3 hover:bg-muted/40 transition-colors">
                    <AccordionTrigger className="flex-1 px-4 py-3 hover:no-underline">
                      <div className="flex items-center gap-3 flex-1 text-left">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <FolderOpen className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold truncate">{section.name}</span>
                            <Badge variant="secondary" className="text-xs font-normal">
                              {totalInSection} {totalInSection === 1 ? "item" : "items"}
                            </Badge>
                            {!section.is_active && (
                              <Badge variant="outline" className="text-xs gap-1">
                                <EyeOff className="h-3 w-3" /> Hidden
                              </Badge>
                            )}
                          </div>
                          {section.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate font-normal">{section.description}</p>
                          )}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="sm" variant="ghost" onClick={() => setResourceDialog({ resource: null, sectionId: section.id })}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Add resource</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="sm" variant="ghost" onClick={() => setSectionDialog(section)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit section</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              if (confirm(`Delete section "${section.name}" and all its resources?`)) {
                                deleteSection.mutate(section.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete section</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                  <AccordionContent className="px-4 pb-4 pt-0">
                    {items.length === 0 ? (
                      <div className="text-center py-8 border-2 border-dashed rounded-lg bg-muted/20">
                        <p className="text-sm text-muted-foreground mb-3">
                          {totalInSection === 0
                            ? "No resources in this section yet."
                            : isFiltering
                              ? "No resources match your filters."
                              : "Nothing to show."}
                        </p>
                        {totalInSection === 0 && (
                          <Button size="sm" variant="outline" onClick={() => setResourceDialog({ resource: null, sectionId: section.id })}>
                            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add resource
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {items.map((r) => (
                          <ResourceRow
                            key={r.id}
                            resource={r}
                            onEdit={() => setResourceDialog({ resource: r })}
                            onDelete={() => { if (confirm(`Delete "${r.title}"?`)) deleteResource.mutate(r.id); }}
                          />
                        ))}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}

        {sectionDialog !== null && (
          <SectionDialog
            section={sectionDialog === "new" ? null : sectionDialog}
            onClose={() => setSectionDialog(null)}
          />
        )}
        {resourceDialog !== null && (
          <ResourceDialog
            resource={resourceDialog.resource}
            defaultSectionId={resourceDialog.sectionId}
            sections={sections}
            onClose={() => setResourceDialog(null)}
          />
        )}
      </div>
    </TooltipProvider>
  );
}

function StatPill({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={cn(
      "hidden md:flex flex-col items-center px-3.5 py-1.5 rounded-lg border bg-background/60 backdrop-blur-sm min-w-[72px]",
      accent && "border-primary/30 bg-primary/5"
    )}>
      <span className={cn("text-lg font-bold leading-none", accent && "text-primary")}>{value}</span>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{label}</span>
    </div>
  );
}

function ResourceRow({ resource, onEdit, onDelete }: { resource: Resource; onEdit: () => void; onDelete: () => void }) {
  const meta = TYPE_META[resource.content_type];
  const Icon = meta.icon;
  return (
    <div className={cn(
      "group flex items-center gap-3 p-3 border rounded-lg bg-background hover:border-primary/40 hover:shadow-sm transition-all",
      !resource.is_active && "opacity-60"
    )}>
      <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", meta.color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">{resource.title}</span>
          <Badge variant="outline" className="text-[10px] font-normal h-5">{meta.label}</Badge>
          {!resource.is_active && (
            <Badge variant="outline" className="text-[10px] font-normal h-5 gap-1">
              <EyeOff className="h-2.5 w-2.5" /> Hidden
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {resource.description && (
            <span className="text-xs text-muted-foreground truncate max-w-md">{resource.description}</span>
          )}
        </div>
        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
          {(resource.resource_audiences ?? []).map((a) => {
            const am = AUDIENCE_META[a.audience_type] ?? AUDIENCE_META.all;
            const AIcon = am.icon;
            return (
              <span
                key={a.id}
                className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
              >
                <AIcon className="h-2.5 w-2.5" />
                {am.label}
              </span>
            );
          })}
          {(resource.resource_audiences ?? []).length === 0 && (
            <span className="text-[10px] text-amber-600">No audience set</span>
          )}
        </div>
      </div>
      <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="sm" variant="ghost" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete} className="text-destructive hover:text-destructive hover:bg-destructive/10">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon, title, description, action,
}: { icon: typeof FolderOpen; title: string; description: string; action?: React.ReactNode }) {
  return (
    <Card className="border-dashed">
      <CardContent className="p-12 text-center">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 text-primary mx-auto mb-4 flex items-center justify-center">
          <Icon className="h-8 w-8" />
        </div>
        <h3 className="font-semibold text-lg mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground mb-5 max-w-sm mx-auto">{description}</p>
        {action}
      </CardContent>
    </Card>
  );
}

function SectionDialog({ section, onClose }: { section: ResourceSection | null; onClose: () => void }) {
  const [name, setName] = useState(section?.name ?? "");
  const [description, setDescription] = useState(section?.description ?? "");
  const [isActive, setIsActive] = useState(section?.is_active ?? true);
  const [order, setOrder] = useState(section?.display_order ?? 0);
  const upsert = useUpsertSection();
  const { toast } = useToast();

  const save = async () => {
    if (!name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    try {
      await upsert.mutateAsync({
        id: section?.id,
        name: name.trim(),
        description: description.trim() || null,
        display_order: order,
        is_active: isActive,
      });
      toast({ title: section ? "Section updated" : "Section created" });
      onClose();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            {section ? "Edit section" : "New section"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="e.g. Templates & Tools" />
          </div>
          <div className="space-y-1.5">
            <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Short summary shown to students"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Display order</Label>
              <Input type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))} />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label className="cursor-pointer">Visible to students</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={upsert.isPending}>{upsert.isPending ? "Saving..." : "Save section"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResourceDialog({
  resource, defaultSectionId, sections, onClose,
}: {
  resource: Resource | null;
  defaultSectionId?: string;
  sections: ResourceSection[];
  onClose: () => void;
}) {
  const [sectionId, setSectionId] = useState(resource?.section_id ?? defaultSectionId ?? sections[0]?.id ?? "");
  const [title, setTitle] = useState(resource?.title ?? "");
  const [description, setDescription] = useState(resource?.description ?? "");
  const [contentType, setContentType] = useState<ResourceContentType>(resource?.content_type ?? "link");
  const [content, setContent] = useState<any>(resource?.content ?? {});
  const [isActive, setIsActive] = useState(resource?.is_active ?? true);
  const [order, setOrder] = useState(resource?.display_order ?? 0);
  const [audiences, setAudiences] = useState(
    (resource?.resource_audiences ?? []).map((a) => ({ audience_type: a.audience_type, target_id: a.target_id }))
  );
  const upsert = useUpsertResource();
  const { toast } = useToast();

  const save = async () => {
    if (!title.trim() || !sectionId) {
      toast({ title: "Title and section required", variant: "destructive" });
      return;
    }
    if (audiences.length === 0) {
      toast({ title: "Add at least one audience rule", variant: "destructive" });
      return;
    }
    try {
      await upsert.mutateAsync({
        resource: {
          id: resource?.id,
          section_id: sectionId,
          title: title.trim(),
          description: description.trim() || null,
          content_type: contentType,
          content,
          display_order: order,
          is_active: isActive,
        },
        audiences,
      });
      toast({ title: resource ? "Resource updated" : "Resource created" });
      onClose();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{resource ? "Edit resource" : "New resource"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          {/* Type picker */}
          <div className="space-y-2">
            <Label>Content type</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.keys(TYPE_META) as ResourceContentType[]).map((t) => {
                const m = TYPE_META[t];
                const Icon = m.icon;
                const active = contentType === t;
                return (
                  <button
                    type="button"
                    key={t}
                    onClick={() => { setContentType(t); setContent({}); }}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all text-xs font-medium",
                      active
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border hover:border-primary/40 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <div className={cn("h-8 w-8 rounded-md flex items-center justify-center", m.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
            <div className="space-y-1.5">
              <Label>Section</Label>
              <Select value={sectionId} onValueChange={setSectionId}>
                <SelectTrigger><SelectValue placeholder="Choose a section" /></SelectTrigger>
                <SelectContent>
                  {sections.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Order</Label>
              <Input type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))} className="w-24" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} placeholder="What is this resource called?" />
          </div>
          <div className="space-y-1.5">
            <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={2} placeholder="Short summary shown alongside the resource" />
          </div>

          <div className="rounded-lg border p-4 bg-muted/20">
            <Label className="mb-3 block text-sm font-semibold">Content</Label>
            {contentType === "link" && <LinkEditor value={content} onChange={setContent} />}
            {contentType === "file" && <FileEditor value={content} onChange={setContent} />}
            {contentType === "rich_text" && <RichTextEditor value={content} onChange={setContent} />}
            {contentType === "table" && <TableEditor value={content} onChange={setContent} />}
          </div>

          <div className="rounded-lg border p-4 bg-muted/20">
            <Label className="mb-1 block text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Who sees this resource?
            </Label>
            <p className="text-xs text-muted-foreground mb-3">Only active students matching at least one rule below will see this.</p>
            <AudienceBuilder value={audiences} onChange={setAudiences} />
          </div>

          <div className="flex items-center gap-2 px-1">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <Label className="cursor-pointer">Active (visible to students)</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={upsert.isPending}>{upsert.isPending ? "Saving..." : "Save resource"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
