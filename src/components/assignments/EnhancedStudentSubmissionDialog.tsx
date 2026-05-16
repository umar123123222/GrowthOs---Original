import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Upload, Link, FileText, X, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { logUserActivity, ACTIVITY_TYPES } from "@/lib/activity-logger";

interface Assignment {
  id: string;
  name: string;
  description?: string;
  submission_type: 'text' | 'links' | 'attachments';
}

interface EnhancedStudentSubmissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: Assignment;
  userId: string;
  hasSubmitted?: boolean;
  onSubmissionComplete?: () => void;
}

export const EnhancedStudentSubmissionDialog = ({ 
  open, 
  onOpenChange, 
  assignment,
  userId,
  hasSubmitted = false,
  onSubmissionComplete
}: EnhancedStudentSubmissionDialogProps) => {
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const [links, setLinks] = useState<string[]>([""]);
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddLink = () => {
    setLinks([...links, ""]);
  };

  const handleRemoveLink = (index: number) => {
    if (links.length > 1) {
      setLinks(links.filter((_, i) => i !== index));
    }
  };

  const handleLinkChange = (index: number, value: string) => {
    const newLinks = [...links];
    newLinks[index] = value;
    setLinks(newLinks);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      setFiles([...files, ...selectedFiles]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const uploadFiles = async (): Promise<string[]> => {
    const uploadedUrls: string[] = [];
    
    for (const file of files) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${userId}/${assignment.id}/${fileName}`;

      const { data, error } = await supabase.storage
        .from('assignment-submissions')
        .upload(filePath, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('assignment-submissions')
        .getPublicUrl(data.path);

      uploadedUrls.push(publicUrl);
    }

    return uploadedUrls;
  };

  const validateSubmission = () => {
    switch (assignment.submission_type) {
      case 'text':
        if (!content.trim()) {
          toast({
            title: "Error",
            description: "Please enter your assignment response.",
            variant: "destructive",
          });
          return false;
        }
        break;
      case 'links':
        const validLinks = links.filter(link => link.trim());
        if (validLinks.length === 0) {
          toast({
            title: "Error",
            description: "Please provide at least one valid link.",
            variant: "destructive",
          });
          return false;
        }
        break;
      case 'attachments':
        if (files.length === 0) {
          toast({
            title: "Error",
            description: "Please attach at least one file.",
            variant: "destructive",
          });
          return false;
        }
        break;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateSubmission()) return;

    setIsSubmitting(true);

    try {
      // Query the latest version to prevent conflicts on resubmission
      const { data: existingSubmissions, error: queryError } = await supabase
        .from('submissions')
        .select('version')
        .eq('student_id', userId)
        .eq('assignment_id', assignment.id)
        .order('version', { ascending: false })
        .limit(1);

      if (queryError) throw queryError;

      const nextVersion = ((existingSubmissions?.[0]?.version) || 0) + 1;

      let submissionData: any = {
        assignment_id: assignment.id,
        student_id: userId,
        status: 'pending',
        version: nextVersion
      };

      switch (assignment.submission_type) {
        case 'text':
          submissionData.content = content.trim();
          break;
        case 'links':
          const validLinks = links.filter(link => link.trim());
          submissionData.links = validLinks;
          submissionData.content = `Submitted ${validLinks.length} link(s)`;
          break;
        case 'attachments':
          const fileUrls = await uploadFiles();
          submissionData.file_urls = fileUrls.map((url, index) => ({
            url,
            name: files[index].name,
            size: files[index].size
          }));
          submissionData.content = `Submitted ${files.length} file(s)`;
          break;
      }

      const { error } = await supabase
        .from('submissions')
        .insert(submissionData);

      if (error) throw error;

      // Auto-mark the linked recording as watched
      try {
        const { data: linkedRecording } = await supabase
          .from('available_lessons')
          .select('id')
          .eq('assignment_id', assignment.id)
          .maybeSingle();
        if (linkedRecording) {
          await supabase.from('recording_views').upsert({
            user_id: userId,
            recording_id: linkedRecording.id,
            watched: true,
            watched_at: new Date().toISOString()
          }, { onConflict: 'user_id,recording_id' });
        }
      } catch (e) {
        console.error('Failed to auto-mark recording watched:', e);
      }

      // Log assignment submission activity
      logUserActivity({
        user_id: userId,
        activity_type: ACTIVITY_TYPES.ASSIGNMENT_SUBMITTED,
        reference_id: assignment.id,
        metadata: {
          assignment_name: assignment.name,
          version: nextVersion,
          submission_type: assignment.submission_type,
          timestamp: new Date().toISOString()
        }
      });

      toast({
        title: "Assignment Submitted",
        description: "Your assignment has been successfully submitted for review.",
      });

      // Reset form
      setContent("");
      setLinks([""]);
      setFiles([]);
      onOpenChange(false);
      onSubmissionComplete?.();
    } catch (error) {
      console.error('Submission error:', error);
      toast({
        title: "Submission Error",
        description: "Failed to submit assignment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const submissionTypeMeta = {
    text: { label: 'Text Response', icon: FileText, accent: 'bg-primary/10 text-primary border-primary/20' },
    links: { label: 'Link Submission', icon: Link, accent: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20' },
    attachments: { label: 'File Upload', icon: Upload, accent: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20' },
  } as const;
  const typeMeta = submissionTypeMeta[assignment.submission_type];
  const TypeIcon = typeMeta.icon;

  const renderSubmissionForm = () => {
    if (hasSubmitted) {
      return (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
          <div className="w-9 h-9 rounded-lg bg-green-500/15 flex items-center justify-center text-green-700 dark:text-green-400 shrink-0">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-green-700 dark:text-green-400">Submission received</p>
            <p className="text-xs text-muted-foreground mt-0.5">Your assignment is under review. You'll be notified once it's graded.</p>
          </div>
        </div>
      );
    }

    switch (assignment.submission_type) {
      case 'text':
        return (
          <div className="space-y-2">
            <label htmlFor="content" className="block text-sm font-semibold">Your Response</label>
            <Textarea
              id="content"
              placeholder="Type your assignment response here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              className="min-h-[200px] resize-y rounded-xl"
            />
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>Be clear and concise. You can edit before submitting.</span>
              <span>{content.trim().split(/\s+/).filter(Boolean).length} words</span>
            </div>
          </div>
        );

      case 'links':
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold">Links</label>
              <Button type="button" variant="outline" size="sm" onClick={handleAddLink} className="h-8">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Link
              </Button>
            </div>
            <div className="space-y-2">
              {links.map((link, index) => (
                <div key={index} className="flex gap-2">
                  <div className="relative flex-1">
                    <Link className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      placeholder="https://example.com"
                      value={link}
                      onChange={(e) => handleLinkChange(index, e.target.value)}
                      className="pl-9 rounded-xl"
                    />
                  </div>
                  {links.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveLink(index)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Paste Google Drive, Notion, Figma, or other view-only links to your work.
            </p>
          </div>
        );

      case 'attachments':
        return (
          <div className="space-y-3">
            <label className="block text-sm font-semibold">Attachments</label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-colors rounded-xl p-6 flex flex-col items-center justify-center text-center group"
            >
              <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <Upload className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-foreground">Click to upload files</p>
              <p className="text-xs text-muted-foreground mt-0.5">PDF, DOC, TXT, JPG, PNG, GIF</p>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileChange}
              className="hidden"
              accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
            />
            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/40 border border-border">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-background border border-border flex items-center justify-center text-muted-foreground shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">{Math.round(file.size / 1024)} KB</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveFile(index)}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden gap-0 max-h-[92vh] flex flex-col">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-border space-y-3 text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${typeMeta.accent}`}>
                <TypeIcon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-bold">
                  {hasSubmitted ? 'Submission Details' : 'Submit Assignment'}
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">{typeMeta.label}</p>
              </div>
            </div>
          </div>
          <h3 className="text-sm font-semibold text-foreground/90 leading-snug">{assignment.name}</h3>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {assignment.description && (
            <div className="rounded-xl bg-muted/40 border border-border p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Assignment Brief
              </p>
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                {assignment.description}
              </p>
            </div>
          )}

          {renderSubmissionForm()}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 pt-4 border-t border-border bg-muted/20">
          {!hasSubmitted ? (
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 font-semibold">
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                className="flex-1 font-bold shadow-md shadow-primary/20"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting..." : "Submit Assignment"}
              </Button>
            </div>
          ) : (
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="font-semibold">
                Close
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};