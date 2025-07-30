import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, Eye, AlertTriangle, CheckCircle, X } from "lucide-react";
import { useState, useRef } from "react";
import { validateLogo, generateLogoVariants, LogoValidationResult } from "@/utils/logoUtils";
import { supabase } from "@/integrations/supabase/client";

interface LogoUploadSectionProps {
  currentLogo: string | null;
  onLogoUpdate: (branding: any) => void;
}

export function LogoUploadSection({ currentLogo, onLogoUpdate }: LogoUploadSectionProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [validation, setValidation] = useState<LogoValidationResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    
    // Validate the file
    const validationResult = await validateLogo(file);
    setValidation(validationResult);
  };

  const handleUpload = async () => {
    if (!selectedFile || !validation?.isValid) return;

    setIsUploading(true);
    try {
      const timestamp = Date.now();
      const fileExt = selectedFile.name.split('.').pop();
      
      // Upload original file
      const originalPath = `logos/original-${timestamp}.${fileExt}`;
      const { error: originalError } = await supabase.storage
        .from('company-branding')
        .upload(originalPath, selectedFile);

      if (originalError) throw originalError;

      // Generate and upload variants
      const variants = await generateLogoVariants(selectedFile);
      
      // Upload favicon variant
      const faviconPath = `logos/favicon-${timestamp}.png`;
      const { error: faviconError } = await supabase.storage
        .from('company-branding')
        .upload(faviconPath, variants[0]);

      if (faviconError) throw faviconError;

      // Upload header variant
      const headerPath = `logos/header-${timestamp}.png`;
      const { error: headerError } = await supabase.storage
        .from('company-branding')
        .upload(headerPath, variants[1]);

      if (headerError) throw headerError;

      // Get public URLs
      const { data: originalUrl } = supabase.storage
        .from('company-branding')
        .getPublicUrl(originalPath);

      const { data: faviconUrl } = supabase.storage
        .from('company-branding')
        .getPublicUrl(faviconPath);

      const { data: headerUrl } = supabase.storage
        .from('company-branding')
        .getPublicUrl(headerPath);

      // Update company settings with branding data
      const brandingData = {
        logo: {
          original: originalUrl.publicUrl,
          favicon: faviconUrl.publicUrl,
          header: headerUrl.publicUrl
        }
      };

      const { error: updateError } = await supabase
        .rpc('update_company_branding', { branding_data: brandingData });

      if (updateError) throw updateError;

      onLogoUpdate(brandingData);
      
      toast({
        title: "Logo uploaded successfully",
        description: "Your company logo has been updated across all applications.",
      });

      // Reset form
      setSelectedFile(null);
      setPreviewUrl(null);
      setValidation(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (error: any) {
      console.error('Logo upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload logo. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setValidation(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Company Logo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Upload Guidelines */}
        <Alert>
          <Eye className="w-4 h-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium">Recommended specifications:</p>
              <ul className="text-sm space-y-1 ml-4">
                <li>• Square format (1:1 aspect ratio) at 512×512 pixels</li>
                <li>• PNG format for best quality with transparency</li>
                <li>• Minimum size: 256×256 pixels</li>
                <li>• Maximum file size: 5MB</li>
              </ul>
            </div>
          </AlertDescription>
        </Alert>

        {/* Current Logo Display */}
        {currentLogo && !previewUrl && (
          <div className="space-y-2">
            <Label>Current Logo</Label>
            <div className="flex items-center gap-4 p-4 border rounded-lg">
              <img 
                src={currentLogo} 
                alt="Current company logo" 
                className="w-16 h-16 object-contain border rounded"
              />
              <div className="text-sm text-muted-foreground">
                Logo is automatically used for favicon, headers, and sign-in page
              </div>
            </div>
          </div>
        )}

        {/* File Input */}
        <div className="space-y-2">
          <Label htmlFor="logo-upload">Upload New Logo</Label>
          <Input
            ref={fileInputRef}
            id="logo-upload"
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/svg+xml"
            onChange={handleFileSelect}
            className="cursor-pointer"
          />
        </div>

        {/* Preview and Validation */}
        {selectedFile && (
          <div className="space-y-4">
            {/* Preview */}
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/20">
                <div className="text-center space-y-2">
                  <div className="text-sm font-medium">Favicon (32×32)</div>
                  <div className="w-8 h-8 mx-auto border rounded bg-background">
                    <img 
                      src={previewUrl!} 
                      alt="Favicon preview" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <div className="text-sm font-medium">Header Logo</div>
                  <div className="h-12 flex items-center justify-center border rounded bg-background">
                    <img 
                      src={previewUrl!} 
                      alt="Header preview" 
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <div className="text-sm font-medium">Original</div>
                  <div className="w-16 h-16 mx-auto border rounded bg-background">
                    <img 
                      src={previewUrl!} 
                      alt="Original preview" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Validation Results */}
            {validation && (
              <div className="space-y-2">
                {validation.errors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="w-4 h-4" />
                    <AlertDescription>
                      <ul className="space-y-1">
                        {validation.errors.map((error, index) => (
                          <li key={index}>• {error}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {validation.warnings.length > 0 && (
                  <Alert>
                    <AlertTriangle className="w-4 h-4" />
                    <AlertDescription>
                      <ul className="space-y-1">
                        {validation.warnings.map((warning, index) => (
                          <li key={index}>• {warning}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {validation.isValid && validation.errors.length === 0 && (
                  <Alert>
                    <CheckCircle className="w-4 h-4" />
                    <AlertDescription>
                      Logo meets all requirements and is ready to upload.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={handleUpload}
                disabled={!validation?.isValid || isUploading}
                className="flex-1"
              >
                {isUploading ? "Uploading..." : "Upload Logo"}
              </Button>
              <Button
                variant="outline"
                onClick={clearSelection}
                disabled={isUploading}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}