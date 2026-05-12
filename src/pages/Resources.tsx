import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderOpen } from "lucide-react";
import { useResourceSections, useResources } from "@/hooks/useResources";
import { ResourceRenderer } from "@/components/resources/ResourceRenderer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function Resources() {
  const { data: sections = [], isLoading: sLoading } = useResourceSections();
  const { data: resources = [], isLoading: rLoading } = useResources();

  const grouped = useMemo(() => {
    const map = new Map<string, typeof resources>();
    sections.forEach((s) => map.set(s.id, []));
    resources.forEach((r) => {
      if (!map.has(r.section_id)) map.set(r.section_id, []);
      map.get(r.section_id)!.push(r);
    });
    return map;
  }, [sections, resources]);

  const visibleSections = sections.filter((s) => (grouped.get(s.id)?.length ?? 0) > 0);

  if (sLoading || rLoading) return <div className="p-6">Loading resources...</div>;

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Resources</h1>
        <p className="text-sm text-muted-foreground">Curated materials, links, and references for your learning journey.</p>
      </div>

      {visibleSections.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-50" />
            No resources available yet.
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" defaultValue={visibleSections.map((s) => s.id)} className="space-y-3">
          {visibleSections.map((section) => (
            <Card key={section.id}>
              <AccordionItem value={section.id} className="border-0">
                <AccordionTrigger className="px-6 hover:no-underline">
                  <div className="text-left">
                    <CardTitle className="text-lg">{section.name}</CardTitle>
                    {section.description && (
                      <p className="text-sm text-muted-foreground font-normal mt-1">{section.description}</p>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <CardContent className="space-y-4 pt-0">
                    {(grouped.get(section.id) ?? []).map((r) => (
                      <div key={r.id} className="border rounded-lg p-4 space-y-2">
                        <div>
                          <h3 className="font-semibold">{r.title}</h3>
                          {r.description && <p className="text-sm text-muted-foreground">{r.description}</p>}
                        </div>
                        <ResourceRenderer resource={r} />
                      </div>
                    ))}
                  </CardContent>
                </AccordionContent>
              </AccordionItem>
            </Card>
          ))}
        </Accordion>
      )}
    </div>
  );
}
