import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ResourceContentType = "link" | "file" | "rich_text" | "table";

export interface ResourceSection {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  display_order: number;
  is_active: boolean;
}

export interface ResourceAudience {
  id: string;
  resource_id: string;
  audience_type: "all" | "pathway" | "course" | "batch";
  target_id: string | null;
}

export interface Resource {
  id: string;
  section_id: string;
  title: string;
  description: string | null;
  content_type: ResourceContentType;
  content: any;
  display_order: number;
  is_active: boolean;
  resource_audiences?: ResourceAudience[];
}

export const useResourceSections = () =>
  useQuery({
    queryKey: ["resource_sections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resource_sections")
        .select("*")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data as ResourceSection[];
    },
  });

export const useResources = () =>
  useQuery({
    queryKey: ["resources_with_audiences"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resources")
        .select("*, resource_audiences(*)")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data as Resource[];
    },
  });

export const useUpsertSection = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: Partial<ResourceSection> & { name: string }) => {
      if (s.id) {
        const { error } = await supabase
          .from("resource_sections")
          .update({
            name: s.name,
            description: s.description ?? null,
            icon: s.icon ?? null,
            display_order: s.display_order ?? 0,
            is_active: s.is_active ?? true,
          })
          .eq("id", s.id);
        if (error) throw error;
      } else {
        const { data: u } = await supabase.auth.getUser();
        const { error } = await supabase.from("resource_sections").insert({
          name: s.name,
          description: s.description ?? null,
          icon: s.icon ?? null,
          display_order: s.display_order ?? 0,
          is_active: s.is_active ?? true,
          created_by: u.user?.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["resource_sections"] }),
  });
};

export const useDeleteSection = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("resource_sections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resource_sections"] });
      qc.invalidateQueries({ queryKey: ["resources_with_audiences"] });
    },
  });
};

export const useUpsertResource = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      resource: Partial<Resource> & { section_id: string; title: string; content_type: ResourceContentType; content: any };
      audiences: Array<Pick<ResourceAudience, "audience_type" | "target_id">>;
    }) => {
      const { resource, audiences } = payload;
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error("Your session has expired. Please sign in again to save changes.");
      }
      let resourceId = resource.id;
      if (resourceId) {
        const { error } = await supabase
          .from("resources")
          .update({
            section_id: resource.section_id,
            title: resource.title,
            description: resource.description ?? null,
            content_type: resource.content_type,
            content: resource.content,
            display_order: resource.display_order ?? 0,
            is_active: resource.is_active ?? true,
          })
          .eq("id", resourceId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("resources")
          .insert({
            section_id: resource.section_id,
            title: resource.title,
            description: resource.description ?? null,
            content_type: resource.content_type,
            content: resource.content,
            display_order: resource.display_order ?? 0,
            is_active: resource.is_active ?? true,
            created_by: sessionData.session.user.id,
          })
          .select("id")
          .single();
        if (error) throw error;
        resourceId = data.id;
      }
      // Replace audiences
      await supabase.from("resource_audiences").delete().eq("resource_id", resourceId!);
      if (audiences.length > 0) {
        const { error: aErr } = await supabase
          .from("resource_audiences")
          .insert(audiences.map((a) => ({ ...a, resource_id: resourceId! })));
        if (aErr) throw aErr;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["resources_with_audiences"] }),
  });
};

export const useDeleteResource = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("resources").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["resources_with_audiences"] }),
  });
};

export const getResourceFileSignedUrl = async (storagePath: string) => {
  const { data, error } = await supabase.storage
    .from("resources")
    .createSignedUrl(storagePath, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
};

export const uploadResourceFile = async (file: File) => {
  const ext = file.name.split(".").pop();
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("resources").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  return {
    storage_path: path,
    file_name: file.name,
    mime_type: file.type,
    size: file.size,
  };
};
