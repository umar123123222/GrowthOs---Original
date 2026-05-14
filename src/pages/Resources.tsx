import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FolderOpen,
  Search,
  Sparkles,
  Link2,
  FileText,
  Table as TableIcon,
  BookOpen,
  X,
} from "lucide-react";
import { useResourceSections, useResources, type Resource, type ResourceContentType } from "@/hooks/useResources";
import { ResourceRenderer } from "@/components/resources/ResourceRenderer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const TYPE_META: Record<ResourceContentType, { label: string; icon: any; tint: string }> = {
  link: { label: "Link", icon: Link2, tint: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  file: { label: "File", icon: FileText, tint: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  rich_text: { label: "Note", icon: BookOpen, tint: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  table: { label: "Table", icon: TableIcon, tint: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
};

export default function Resources() {
  const { data: sections = [], isLoading: sLoading } = useResourceSections();
  const { data: resources = [], isLoading: rLoading } = useResources();
  const [query, setQuery] = useState("");
  const [activeSection, setActiveSection] = useState<string | "all">("all");

  const filteredResources = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return resources;
    return resources.filter((r) => {
      const hay = `${r.title} ${r.description ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [resources, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, Resource[]>();
    sections.forEach((s) => map.set(s.id, []));
    filteredResources.forEach((r) => {
      if (!map.has(r.section_id)) map.set(r.section_id, []);
      map.get(r.section_id)!.push(r);
    });
    return map;
  }, [sections, filteredResources]);

  const visibleSections = sections.filter((s) => (grouped.get(s.id)?.length ?? 0) > 0);
  const sectionsToRender =
    activeSection === "all" ? visibleSections : visibleSections.filter((s) => s.id === activeSection);

  const totalCount = filteredResources.length;
  const isLoading = sLoading || rLoading;

  return (
    <div className="container max-w-6xl py-8 space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-background p-6 md:p-8">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" aria-hidden />
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
              <Sparkles className="h-3.5 w-3.5" />
              Learning library
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Resources</h1>
            <p className="text-sm md:text-base text-muted-foreground max-w-xl">
              Curated materials, links and references hand-picked to support your learning journey.
            </p>
          </div>
          <div className="w-full md:w-80">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search resources..."
                className="pl-9 pr-9 bg-background/80 backdrop-blur"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted text-muted-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {query && (
              <p className="mt-2 text-xs text-muted-foreground">
                {totalCount} {totalCount === 1 ? "result" : "results"}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Section chips */}
      {!isLoading && visibleSections.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <ChipButton
            active={activeSection === "all"}
            onClick={() => setActiveSection("all")}
            label="All"
            count={totalCount}
          />
          {visibleSections.map((s) => (
            <ChipButton
              key={s.id}
              active={activeSection === s.id}
              onClick={() => setActiveSection(s.id)}
              label={s.name}
              count={grouped.get(s.id)?.length ?? 0}
            />
          ))}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : sectionsToRender.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <FolderOpen className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold mb-1">
              {query ? "No matches found" : "No resources available yet"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {query
                ? "Try a different keyword or clear the search."
                : "Check back soon — your mentors will add materials here."}
            </p>
            {query && (
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setQuery("")}>
                Clear search
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Accordion
          type="multiple"
          defaultValue={sectionsToRender.map((s) => s.id)}
          className="space-y-4"
        >
          {sectionsToRender.map((section) => {
            const items = grouped.get(section.id) ?? [];
            return (
              <Card key={section.id} className="overflow-hidden border-border/60 hover:border-border transition-colors">
                <AccordionItem value={section.id} className="border-0">
                  <AccordionTrigger className="px-5 md:px-6 py-4 hover:no-underline group">
                    <div className="flex items-center gap-4 text-left flex-1 min-w-0">
                      <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                        <FolderOpen className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h2 className="text-base md:text-lg font-semibold truncate">{section.name}</h2>
                          <Badge variant="secondary" className="rounded-full font-medium">
                            {items.length}
                          </Badge>
                        </div>
                        {section.description && (
                          <p className="text-sm text-muted-foreground font-normal mt-0.5 line-clamp-1">
                            {section.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="px-5 md:px-6 pb-5 grid gap-3 sm:grid-cols-2">
                      {items.map((r) => (
                        <ResourceCard key={r.id} resource={r} />
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Card>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}

function ChipButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all ${
        active
          ? "bg-primary text-primary-foreground border-primary shadow-sm"
          : "bg-background hover:bg-muted text-foreground border-border"
      }`}
    >
      {label}
      <span
        className={`text-xs rounded-full px-1.5 py-0.5 ${
          active ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function ResourceCard({ resource }: { resource: Resource }) {
  const meta = TYPE_META[resource.content_type] ?? TYPE_META.rich_text;
  const Icon = meta.icon;
  const isInline = resource.content_type === "rich_text" || resource.content_type === "table";

  return (
    <div className="group relative rounded-xl border bg-card p-4 transition-all hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5">
      <div className="flex items-start gap-3">
        <div className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center ${meta.tint}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm md:text-base leading-snug">{resource.title}</h3>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide font-medium">
              {meta.label}
            </Badge>
          </div>
          {resource.description && (
            <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
              {resource.description}
            </p>
          )}
        </div>
      </div>
      <div className={isInline ? "mt-3" : "mt-3 flex justify-end"}>
        <ResourceRenderer resource={resource} />
      </div>
    </div>
  );
}
