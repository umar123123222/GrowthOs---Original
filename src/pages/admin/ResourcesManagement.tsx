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
import { Plus, Pencil, Trash2, FolderOpen } from "lucide-react";
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

export default function ResourcesManagement() {
  const { data: sections = [], isLoading: sLoading } = useResourceSections();
  const { data: resources = [], isLoading: rLoading } = useResources();
  const deleteSection = useDeleteSection();
  const deleteResource = useDeleteResource();
  const { toast } = useToast();

  const [sectionDialog, setSectionDialog] = useState<ResourceSection | null | "new">(null);
  const [resourceDialog, setResourceDialog] = useState<{ resource: Resource | null; sectionId?: string } | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, Resource[]>();
    sections.forEach((s) => map.set(s.id, []));
    resources.forEach((r) => {
      if (!map.has(r.section_id)) map.set(r.section_id, []);
      map.get(r.section_id)!.push(r);
    });
    return map;
  }, [sections, resources]);

  if (sLoading || rLoading) return <div className="p-6">Loading...</div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Resources</h1>
          <p className="text-sm text-muted-foreground">
            Curated content for students. Group resources into sections and target them by pathway, course, or batch.
          </p>
        </div>
        <Button onClick={() => setSectionDialog("new")}>
          <Plus className="h-4 w-4 mr-2" /> New section
        </Button>
      </div>

      {sections.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-50" />
            No sections yet. Create one to start adding resources.
          </CardContent>
        </Card>
      ) : (
        sections.map((section) => (
          <Card key={section.id}>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {section.name}
                  {!section.is_active && <Badge variant="outline">Hidden</Badge>}
                </CardTitle>
                {section.description && (
                  <p className="text-sm text-muted-foreground mt-1">{section.description}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setResourceDialog({ resource: null, sectionId: section.id })}>
                  <Plus className="h-4 w-4 mr-1" /> Resource
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSectionDialog(section)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (confirm(`Delete section "${section.name}" and all its resources?`)) {
                      deleteSection.mutate(section.id);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {(grouped.get(section.id) ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No resources in this section yet.</p>
              ) : (
                <div className="space-y-2">
                  {(grouped.get(section.id) ?? []).map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">{r.title}</span>
                          <Badge variant="secondary" className="capitalize">{r.content_type.replace("_", " ")}</Badge>
                          {!r.is_active && <Badge variant="outline">Hidden</Badge>}
                          {(r.resource_audiences ?? []).map((a) => (
                            <Badge key={a.id} variant="outline" className="text-xs">
                              {a.audience_type === "all" ? "All" : a.audience_type}
                            </Badge>
                          ))}
                        </div>
                        {r.description && <p className="text-xs text-muted-foreground mt-1 truncate">{r.description}</p>}
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setResourceDialog({ resource: r })}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { if (confirm(`Delete "${r.title}"?`)) deleteResource.mutate(r.id); }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))
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
        <DialogHeader><DialogTitle>{section ? "Edit section" : "New section"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
          </div>
          <div>
            <Label>Display order</Label>
            <Input type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <Label>Active (visible to students)</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={upsert.isPending}>{upsert.isPending ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResourceDialog({
  resource,
  defaultSectionId,
  sections,
  onClose,
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
        <DialogHeader><DialogTitle>{resource ? "Edit resource" : "New resource"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Section</Label>
              <Select value={sectionId} onValueChange={setSectionId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {sections.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Type</Label>
              <Select value={contentType} onValueChange={(v: any) => { setContentType(v); setContent({}); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="link">External link</SelectItem>
                  <SelectItem value="file">File upload</SelectItem>
                  <SelectItem value="rich_text">Rich text / notes</SelectItem>
                  <SelectItem value="table">Table</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} />
          </div>
          <div>
            <Label>Description (optional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={2} />
          </div>
          <div className="border-t pt-4">
            {contentType === "link" && <LinkEditor value={content} onChange={setContent} />}
            {contentType === "file" && <FileEditor value={content} onChange={setContent} />}
            {contentType === "rich_text" && <RichTextEditor value={content} onChange={setContent} />}
            {contentType === "table" && <TableEditor value={content} onChange={setContent} />}
          </div>
          <div className="border-t pt-4">
            <Label className="mb-2 block">Who sees this resource?</Label>
            <AudienceBuilder value={audiences} onChange={setAudiences} />
          </div>
          <div className="grid grid-cols-2 gap-3 border-t pt-4">
            <div>
              <Label>Display order</Label>
              <Input type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))} />
            </div>
            <div className="flex items-center gap-2 mt-6">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>Active</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={upsert.isPending}>{upsert.isPending ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
