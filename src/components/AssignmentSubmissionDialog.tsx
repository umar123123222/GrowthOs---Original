import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Link, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AssignmentSubmissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignmentTitle: string;
  lessonTitle: string;
}

export const AssignmentSubmissionDialog = ({ 
  open, 
  onOpenChange, 
  assignmentTitle, 
  lessonTitle 
}: AssignmentSubmissionDialogProps) => {
  const { toast } = useToast();
  const [submissionType, setSubmissionType] = useState("text");
  const [textResponse, setTextResponse] = useState("");
  const [externalLink, setExternalLink] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = () => {
    if (submissionType === "text" && !textResponse.trim()) {
      toast({
        title: "Error",
        description: "Please enter your assignment response.",
        variant: "destructive",
      });
      return;
    }

    if (submissionType === "link" && !externalLink.trim()) {
      toast({
        title: "Error", 
        description: "Please enter a valid link.",
        variant: "destructive",
      });
      return;
    }

    if (submissionType === "file" && !file) {
      toast({
        title: "Error",
        description: "Please select a file to upload.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Assignment Submitted",
      description: "Your assignment has been successfully submitted for review.",
    });

    // Reset form
    setTextResponse("");
    setExternalLink("");
    setFile(null);
    onOpenChange(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Submit Assignment</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {lessonTitle} - {assignmentTitle}
          </p>
        </DialogHeader>
        
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Assignment Details</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Complete the assignment based on the lesson content and submit your work below.
              </p>
            </CardContent>
          </Card>

          <Tabs value={submissionType} onValueChange={setSubmissionType}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="text" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Text
              </TabsTrigger>
              <TabsTrigger value="link" className="flex items-center gap-2">
                <Link className="w-4 h-4" />
                Link
              </TabsTrigger>
              <TabsTrigger value="file" className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                File
              </TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="space-y-3">
              <Label htmlFor="text-response">Your Response</Label>
              <Textarea
                id="text-response"
                placeholder="Enter your assignment response here..."
                value={textResponse}
                onChange={(e) => setTextResponse(e.target.value)}
                rows={6}
              />
            </TabsContent>

            <TabsContent value="link" className="space-y-3">
              <Label htmlFor="external-link">Assignment Link</Label>
              <Input
                id="external-link"
                type="url"
                placeholder="https://example.com/your-assignment"
                value={externalLink}
                onChange={(e) => setExternalLink(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Share a link to your Google Doc, GitHub repo, or other online assignment.
              </p>
            </TabsContent>

            <TabsContent value="file" className="space-y-3">
              <Label htmlFor="file-upload">Upload File</Label>
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <Input
                  id="file-upload"
                  type="file"
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.txt,.jpg,.png"
                />
                <Label 
                  htmlFor="file-upload" 
                  className="cursor-pointer text-sm font-medium"
                >
                  {file ? file.name : "Click to upload or drag and drop"}
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, DOC, DOCX, TXT, JPG, PNG (max 10MB)
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSubmit} className="flex-1">
              Submit Assignment
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};