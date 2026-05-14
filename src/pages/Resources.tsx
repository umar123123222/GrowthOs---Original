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
  LayoutGrid,
  List,
  ArrowUpRight,
} from "lucide-react";
import { useResourceSections, useResources, type Resource, type ResourceContentType } from "@/hooks/useResources";
import { ResourceRenderer } from "@/components/resources/ResourceRenderer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const TYPE_META: Record<ResourceContentType, { label: string; icon: any; tint: string; ring: string }> = {
  link: {
    label: "Link",
    icon: Link2,
    tint: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    ring: "group-hover:ring-blue-500/30",
  },
  file: {
    label: "File",
    icon: FileText,
    tint: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    ring: "group-hover:ring-amber-500/30",
  },
  rich_text: {
    label: "Note",
    icon: BookOpen,
    tint: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    ring: "group-hover:ring-emerald-500/30",
  },
  table: {
    label: "Table",
    icon: TableIcon,
    tint: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    ring: "group-hover:ring-purple-500/30",
  },
};

type ViewMode = "grid" | "list";

export default function Resources() {
  const { data: sections = [], isLoading: sLoading } = useResourceSections();
  const { data: resources = [], isLoading: rLoading } = useResources();
  const [query, setQuery] = useState("");
  const [activeSection, setActiveSection] = useState<string | "all">("all");
  const [activeType, setActiveType] = useState<ResourceContentType | "all">("all");
  const [view, setView] = useState<ViewMode>("grid");

  const filteredResources = useMemo(() => {
    const q = query.trim().toLowerCase();
    return resources.filter((r) => {
      if (activeType !== "all" && r.content_type !== activeType) return false;
      if (!q) return true;
      const hay = `${r.title} ${r.description ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [resources, query, activeType]);

  const grouped = useMemo(() => {
    const map = new Map<string, Resource[]>();
    sections.forEach((s) => map.set(s.id, []));
    filteredResources.forEach((r) => {
      if (!map.has(r.section_id)) map.set(r.section_id, []);
      map.get(r.section_id)!.push(r);
    });
    return map;
  }, [sections, filteredResources]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: resources.length, link: 0, file: 0, rich_text: 0, table: 0 };
    resources.forEach((r) => {
      counts[r.content_type] = (counts[r.content_type] ?? 0) + 1;
    });
    return counts;
  }, [resources]);

  const visibleSections = sections.filter((s) => (grouped.get(s.id)?.length ?? 0) > 0);
  const sectionsToRender =
    activeSection === "all" ? visibleSections : visibleSections.filter((s) => s.id === activeSection);

  const totalCount = filteredResources.length;
  const isLoading = sLoading || rLoading;
  const hasFilters = !!query || activeSection !== "all" || activeType !== "all";

  const clearFilters = () => {
    setQuery("");
    setActiveSection("all");
    setActiveType("all");
  };

  return (
    <div className="container max-w-6xl py-6 md:py-8 space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/10 via-background to-background p-6 md:p-10">
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/15 blur-3xl" aria-hidden />
        <div className="absolute -bottom-32 -left-16 h-56 w-56 rounded-full bg-primary/5 blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium border border-primary/20">
                <Sparkles className="h-3.5 w-3.5" />
                Learning library
              </div>
              <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
                Everything you need,
                <span className="block text-primary">in one place.</span>
              </h1>
              <p className="text-sm md:text-base text-muted-foreground">
                Curated materials, links, and references to support your learning journey.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <StatPill label="Sections" value={sections.length} />
              <StatPill label="Resources" value={resources.length} />
            </div>
          </div>

          {/* Search */}
          <div className="relative max-w-2xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title or description..."
              className="pl-11 pr-11 h-12 bg-background/80 backdrop-blur border-border/60 rounded-xl text-sm shadow-sm"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      {!isLoading && resources.length > 0 && (
        <div className="flex flex-col gap-3">
          {/* Type filters */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground mr-1">Type:</span>
            <TypeChip
              active={activeType === "all"}
              onClick={() => setActiveType("all")}
              label="All"
              count={typeCounts.all}
            />
            {(Object.keys(TYPE_META) as ResourceContentType[]).map((t) => {
              const meta = TYPE_META[t];
              const Icon = meta.icon;
              if (!typeCounts[t]) return null;
              return (
                <TypeChip
                  key={t}
                  active={activeType === t}
                  onClick={() => setActiveType(t)}
                  label={meta.label}
                  count={typeCounts[t]}
                  icon={<Icon className="h-3.5 w-3.5" />}
                />
              );
            })}
          </div>

          {/* Sections + view toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground mr-1">Section:</span>
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

            <div className="flex items-center gap-2">
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs gap-1">
                  <X className="h-3.5 w-3.5" />
                  Reset
                </Button>
              )}
              <div className="inline-flex rounded-lg border bg-background p-0.5">
                <button
                  onClick={() => setView("grid")}
                  className={`h-7 w-7 inline-flex items-center justify-center rounded-md transition-colors ${
                    view === "grid" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-label="Grid view"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setView("list")}
                  className={`h-7 w-7 inline-flex items-center justify-center rounded-md transition-colors ${
                    view === "list" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-label="List view"
                >
                  <List className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-2xl" />
          ))}
        </div>
      ) : sectionsToRender.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <FolderOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold mb-1">
              {hasFilters ? "No matches found" : "No resources available yet"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              {hasFilters
                ? "Try a different keyword or reset your filters."
                : "Check back soon — your mentors will add materials here."}
            </p>
            {hasFilters && (
              <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
                Reset filters
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
              <Card
                key={section.id}
                className="overflow-hidden border-border/60 hover:border-border transition-colors shadow-sm"
              >
                <AccordionItem value={section.id} className="border-0">
                  <AccordionTrigger className="px-5 md:px-6 py-4 hover:no-underline group hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-4 text-left flex-1 min-w-0">
                      <div className="h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary flex items-center justify-center ring-1 ring-primary/10 group-hover:ring-primary/25 transition-all">
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
                    <div
                      className={`px-5 md:px-6 pb-5 ${
                        view === "grid" ? "grid gap-3 sm:grid-cols-2" : "flex flex-col gap-2"
                      }`}
                    >
                      {items.map((r) =>
                        view === "grid" ? (
                          <ResourceCard key={r.id} resource={r} />
                        ) : (
                          <ResourceRow key={r.id} resource={r} />
                        )
                      )}
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

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center px-3 py-1.5 rounded-xl bg-background/60 backdrop-blur border border-border/60">
      <span className="text-base font-bold text-foreground leading-none">{value}</span>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">{label}</span>
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
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs md:text-sm font-medium transition-all ${
        active
          ? "bg-primary text-primary-foreground border-primary shadow-sm"
          : "bg-background hover:bg-muted text-foreground border-border"
      }`}
    >
      {label}
      <span
        className={`text-[10px] rounded-full px-1.5 py-0.5 ${
          active ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function TypeChip({
  active,
  onClick,
  label,
  count,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all ${
        active
          ? "bg-foreground text-background border-foreground shadow-sm"
          : "bg-background hover:bg-muted text-foreground border-border"
      }`}
    >
      {icon}
      {label}
      <span className={`text-[10px] ${active ? "opacity-70" : "text-muted-foreground"}`}>· {count}</span>
    </button>
  );
}

function ResourceCard({ resource }: { resource: Resource }) {
  const meta = TYPE_META[resource.content_type] ?? TYPE_META.rich_text;
  const Icon = meta.icon;
  const isInline = resource.content_type === "rich_text" || resource.content_type === "table";

  return (
    <div className="group relative flex flex-col rounded-xl border bg-card p-4 transition-all hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5">
      <div className="flex items-start gap-3">
        <div
          className={`h-10 w-10 shrink-0 rounded-lg flex items-center justify-center ring-1 ring-transparent transition-all ${meta.tint} ${meta.ring}`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-sm md:text-base leading-snug">{resource.title}</h3>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide font-medium shrink-0">
              {meta.label}
            </Badge>
          </div>
          {resource.description && (
            <p className="text-xs md:text-sm text-muted-foreground leading-relaxed line-clamp-2">
              {resource.description}
            </p>
          )}
        </div>
      </div>
      <div className={`${isInline ? "mt-3" : "mt-4 flex justify-end"} flex-1`}>
        <ResourceRenderer resource={resource} />
      </div>
    </div>
  );
}

function ResourceRow({ resource }: { resource: Resource }) {
  const meta = TYPE_META[resource.content_type] ?? TYPE_META.rich_text;
  const Icon = meta.icon;
  const isInline = resource.content_type === "rich_text" || resource.content_type === "table";

  return (
    <div className="group flex items-start gap-3 rounded-lg border bg-card p-3 transition-all hover:bg-muted/40 hover:border-primary/30">
      <div className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center ${meta.tint}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-medium text-sm">{resource.title}</h3>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
            {meta.label}
          </Badge>
        </div>
        {resource.description && (
          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{resource.description}</p>
        )}
        {isInline && (
          <div className="mt-2">
            <ResourceRenderer resource={resource} />
          </div>
        )}
      </div>
      {!isInline && (
        <div className="shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity">
          <ResourceRenderer resource={resource} />
        </div>
      )}
    </div>
  );
}
