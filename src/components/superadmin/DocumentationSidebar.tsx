import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Folder, 
  FolderOpen, 
  ChevronRight, 
  ChevronDown,
  Clock,
  HardDrive
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DocumentFile {
  path: string;
  name: string;
  title: string;
  size: number;
  lastModified: Date;
  isDirectory: boolean;
  children?: DocumentFile[];
}

interface DocumentationSidebarProps {
  files: DocumentFile[];
  selectedFile: string | null;
  onFileSelect: (filePath: string) => void;
}

interface ExpandedFolders {
  [key: string]: boolean;
}

export function DocumentationSidebar({ files, selectedFile, onFileSelect }: DocumentationSidebarProps) {
  const [expandedFolders, setExpandedFolders] = useState<ExpandedFolders>({});

  // Auto-expand folders that contain the selected file
  useEffect(() => {
    if (selectedFile) {
      const pathParts = selectedFile.split('/');
      const newExpanded: ExpandedFolders = {};
      
      // Build folder paths and expand them
      for (let i = 1; i < pathParts.length; i++) {
        const folderPath = pathParts.slice(0, i + 1).join('/');
        newExpanded[folderPath] = true;
      }
      
      setExpandedFolders(prev => ({ ...prev, ...newExpanded }));
    }
  }, [selectedFile]);

  // Persist sidebar scroll position
  useEffect(() => {
    const sidebarElement = document.getElementById('docs-sidebar');
    if (sidebarElement) {
      const savedScrollTop = localStorage.getItem('docs-sidebar-scroll');
      if (savedScrollTop) {
        sidebarElement.scrollTop = parseInt(savedScrollTop, 10);
      }
    }
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    localStorage.setItem('docs-sidebar-scroll', scrollTop.toString());
  };

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderPath]: !prev[folderPath]
    }));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const renderFileItem = (file: DocumentFile, depth: number = 0) => {
    const isSelected = selectedFile === file.path;
    const isExpanded = expandedFolders[file.path];
    
    if (file.isDirectory) {
      return (
        <div key={file.path}>
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start text-left h-auto py-2 px-2 hover:bg-muted/50",
              "text-sm font-medium"
            )}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            onClick={() => toggleFolder(file.path)}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 flex-shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 flex-shrink-0" />
              )}
              {isExpanded ? (
                <FolderOpen className="h-4 w-4 flex-shrink-0 text-blue-600" />
              ) : (
                <Folder className="h-4 w-4 flex-shrink-0 text-blue-600" />
              )}
              <span className="truncate text-foreground">{file.title}</span>
              {file.children && (
                <Badge variant="secondary" className="ml-auto text-xs h-5">
                  {file.children.length}
                </Badge>
              )}
            </div>
          </Button>
          
          {isExpanded && file.children && (
            <div className="space-y-1">
              {file.children.map(child => renderFileItem(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    return (
      <Button
        key={file.path}
        variant="ghost"
        className={cn(
          "w-full justify-start text-left h-auto py-3 px-2 hover:bg-muted/50",
          isSelected && "bg-primary/10 text-primary border-r-2 border-primary",
          "text-sm transition-all duration-200"
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => onFileSelect(file.path)}
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <FileText className={cn(
            "h-4 w-4 flex-shrink-0 mt-0.5",
            isSelected ? "text-primary" : "text-muted-foreground"
          )} />
          <div className="flex-1 min-w-0">
            <div className={cn(
              "font-medium truncate",
              isSelected ? "text-primary" : "text-foreground"
            )}>
              {file.title}
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
              <div className="flex items-center gap-1">
                <HardDrive className="h-3 w-3" />
                <span>{formatFileSize(file.size)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{formatDate(file.lastModified)}</span>
              </div>
            </div>
          </div>
        </div>
      </Button>
    );
  };

  return (
    <div 
      id="docs-sidebar"
      className="p-2 space-y-1"
      onScroll={handleScroll}
    >
      {files.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No documentation files found</p>
        </div>
      ) : (
        files.map(file => renderFileItem(file))
      )}
    </div>
  );
}