import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { FileText, BookOpen, Menu, X, Search, Home, ChevronRight } from 'lucide-react';
import { DocumentationSidebar } from './DocumentationSidebar';
import { MarkdownRenderer } from './MarkdownRenderer';
import { useToast } from '@/hooks/use-toast';

interface DocumentFile {
  path: string;
  name: string;
  title: string;
  size: number;
  lastModified: Date;
  isDirectory: boolean;
  children?: DocumentFile[];
}

interface Breadcrumb {
  name: string;
  path: string;
}

export function DocumentationViewer() {
  const [files, setFiles] = useState<DocumentFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [markdownContent, setMarkdownContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([
    { name: 'Dashboard', path: '/superadmin' },
    { name: 'Documentation', path: '/superadmin?tab=docs' }
  ]);
  const { toast } = useToast();

  // Mock documentation files structure - in a real implementation, 
  // this would be fetched from the server or file system
  const mockDocFiles: DocumentFile[] = [
    {
      path: 'docs/index.md',
      name: 'index.md',
      title: 'Growth OS Documentation',
      size: 4500,
      lastModified: new Date('2024-01-15'),
      isDirectory: false
    },
    {
      path: 'docs/architecture.md',
      name: 'architecture.md', 
      title: 'Architecture Overview',
      size: 8200,
      lastModified: new Date('2024-01-14'),
      isDirectory: false
    },
    {
      path: 'docs/deployment.md',
      name: 'deployment.md',
      title: 'Deployment Guide',
      size: 6800,
      lastModified: new Date('2024-01-13'),
      isDirectory: false
    },
    {
      path: 'docs/features',
      name: 'features',
      title: 'Features',
      size: 0,
      lastModified: new Date('2024-01-12'),
      isDirectory: true,
      children: [
        {
          path: 'docs/features/authentication-system.md',
          name: 'authentication-system.md',
          title: 'Authentication System',
          size: 5200,
          lastModified: new Date('2024-01-12'),
          isDirectory: false
        },
        {
          path: 'docs/features/student-management.md',
          name: 'student-management.md',
          title: 'Student Management System',
          size: 7400,
          lastModified: new Date('2024-01-12'),
          isDirectory: false
        },
        {
          path: 'docs/features/learning-management.md',
          name: 'learning-management.md',
          title: 'Learning Management System',
          size: 6900,
          lastModified: new Date('2024-01-12'),
          isDirectory: false
        },
        {
          path: 'docs/features/assignment-system.md',
          name: 'assignment-system.md',
          title: 'Assignment System',
          size: 8100,
          lastModified: new Date('2024-01-12'),
          isDirectory: false
        },
        {
          path: 'docs/features/financial-management.md',
          name: 'financial-management.md',
          title: 'Financial Management System',
          size: 5600,
          lastModified: new Date('2024-01-11'),
          isDirectory: false
        }
      ]
    },
    {
      path: 'docs/integrations',
      name: 'integrations',
      title: 'Integrations',
      size: 0,
      lastModified: new Date('2024-01-11'),
      isDirectory: true,
      children: [
        {
          path: 'docs/integrations/supabase.md',
          name: 'supabase.md',
          title: 'Supabase Integration',
          size: 4800,
          lastModified: new Date('2024-01-11'),
          isDirectory: false
        },
        {
          path: 'docs/integrations/resend.md',
          name: 'resend.md',
          title: 'Resend Email Integration',
          size: 3200,
          lastModified: new Date('2024-01-11'),
          isDirectory: false
        },
        {
          path: 'docs/integrations/shopify.md',
          name: 'shopify.md',
          title: 'Shopify Integration',
          size: 4100,
          lastModified: new Date('2024-01-11'),
          isDirectory: false
        }
      ]
    },
    {
      path: 'docs/roles',
      name: 'roles',
      title: 'User Roles',
      size: 0,
      lastModified: new Date('2024-01-10'),
      isDirectory: true,
      children: [
        {
          path: 'docs/roles/admin-role.md',
          name: 'admin-role.md',
          title: 'Admin Role',
          size: 3800,
          lastModified: new Date('2024-01-10'),
          isDirectory: false
        },
        {
          path: 'docs/roles/student-role.md',
          name: 'student-role.md',
          title: 'Student Role',
          size: 3200,
          lastModified: new Date('2024-01-10'),
          isDirectory: false
        },
        {
          path: 'docs/roles/mentor-role.md',
          name: 'mentor-role.md',
          title: 'Mentor Role',
          size: 4200,
          lastModified: new Date('2024-01-10'),
          isDirectory: false
        },
        {
          path: 'docs/roles/superadmin-role.md',
          name: 'superadmin-role.md',
          title: 'Superadmin Role',
          size: 5800,
          lastModified: new Date('2024-01-10'),
          isDirectory: false
        }
      ]
    },
    {
      path: 'docs/faq.md',
      name: 'faq.md',
      title: 'Frequently Asked Questions',
      size: 4200,
      lastModified: new Date('2024-01-09'),
      isDirectory: false
    },
    {
      path: 'docs/glossary.md',
      name: 'glossary.md',
      title: 'Glossary',
      size: 3100,
      lastModified: new Date('2024-01-09'),
      isDirectory: false
    }
  ];

  const loadDocumentationFiles = useCallback(async () => {
    try {
      setLoading(true);
      // In a real implementation, this would fetch from an API endpoint
      // that reads the file system or a content management system
      await new Promise(resolve => setTimeout(resolve, 800)); // Simulate loading
      setFiles(mockDocFiles);
      
      // Auto-select the main documentation file
      if (!selectedFile) {
        setSelectedFile('docs/index.md');
      }
    } catch (error) {
      console.error('Error loading documentation files:', error);
      toast({
        title: "Error",
        description: "Failed to load documentation files. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [selectedFile, toast]);

  const loadMarkdownContent = useCallback(async (filePath: string) => {
    try {
      setLoading(true);
      
      // Mock markdown content - in real implementation, fetch from file system
      const mockContent = getMockMarkdownContent(filePath);
      await new Promise(resolve => setTimeout(resolve, 400)); // Simulate loading
      
      setMarkdownContent(mockContent);
      
      // Update breadcrumbs
      const fileName = filePath.split('/').pop()?.replace('.md', '') || '';
      const fileTitle = files.flatMap(f => f.isDirectory ? f.children || [] : [f])
        .find(f => f.path === filePath)?.title || fileName;
      
      setBreadcrumbs([
        { name: 'Dashboard', path: '/superadmin' },
        { name: 'Documentation', path: '/superadmin?tab=docs' },
        { name: fileTitle, path: filePath }
      ]);
      
    } catch (error) {
      console.error('Error loading markdown content:', error);
      toast({
        title: "Error", 
        description: "Failed to load document content. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [files, toast]);

  const getMockMarkdownContent = (filePath: string): string => {
    // Mock content for demonstration - in real implementation, read from files
    const contents: Record<string, string> = {
      'docs/index.md': `# Growth OS Documentation

## Executive Overview

Growth OS is a comprehensive Learning Management System (LMS) designed for e-commerce education and mentorship programs. Built with React, TypeScript, and Supabase, it provides a complete platform for student onboarding, course delivery, assignment management, and financial tracking.

### Key Capabilities

- **Multi-Role Authentication System** - 5 distinct user roles with granular permissions
- **Sequential Learning Management** - Unlock-based content progression with assignments  
- **Mentorship Program** - Dedicated mentor-student relationships with progress tracking
- **Financial Management** - Installment payment tracking with automated invoicing
- **Live Session Scheduling** - Success sessions with mentor assignment
- **Comprehensive Notifications** - Real-time updates via email and in-app messaging

### Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Email**: Resend API with custom SMTP configuration
- **Integrations**: Shopify, Zapier webhooks
- **File Storage**: Supabase Storage (assignments, branding assets)

## Getting Started

1. **Local Development**
   \`\`\`bash
   git clone <repository-url>
   cd growth-os
   npm install
   npm run dev
   \`\`\`

2. **Environment Setup**
   - Configure Supabase project
   - Set up email delivery service
   - Configure company branding

3. **First Admin User**
   - Create superadmin account via Supabase Auth
   - Configure company settings in admin panel
   - Set up first mentor and student accounts`,

      'docs/architecture.md': `# Architecture Overview

## System Overview

Growth OS is built on a modern, scalable architecture using React frontend with Supabase backend services.

### Core Components

#### Frontend Architecture
- **React 18** with TypeScript for type safety
- **Tailwind CSS** for styling with custom design system
- **shadcn/ui** for consistent UI components
- **React Router** for client-side routing
- **TanStack Query** for server state management

#### Backend Architecture
- **Supabase PostgreSQL** for primary data storage
- **Row Level Security (RLS)** for data access control
- **Supabase Auth** for authentication and authorization
- **Edge Functions** for serverless business logic
- **Supabase Storage** for file uploads and assets

### Security Architecture

#### Authentication Flow
1. User login via Supabase Auth
2. JWT token issued with role claims
3. Frontend validates token and role permissions
4. Backend enforces RLS policies

#### Data Access Control
- Role-based access control (RBAC)
- Row Level Security policies
- API endpoint protection
- File storage access controls`,

      'docs/features/authentication-system.md': `# Authentication System

## Overview

Growth OS implements a comprehensive role-based authentication system supporting five distinct user roles with granular permissions and secure access controls.

## User Roles

### Role Hierarchy

1. **Superadmin** - Complete system control and configuration
2. **Admin** - Platform administration and user management  
3. **Enrollment Manager** - Student onboarding and enrollment
4. **Mentor** - Student guidance and assignment review
5. **Student** - Learning platform access and progress tracking

### Technical Implementation

#### Database Structure
\`\`\`sql
-- User profiles table
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL,
  student_id TEXT UNIQUE,
  mentor_id UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
\`\`\`

#### Security Features
- Row Level Security (RLS) policies
- JWT token validation
- Role-based route protection
- API endpoint security`,

      'docs/features/student-management.md': `# Student Management System

## Overview

The Student Management System handles the complete student lifecycle from initial enrollment through course completion, including onboarding, progress tracking, and administrative oversight.

## Student Lifecycle

### 1. Enrollment Process

**Initiated By**: Enrollment Managers, Admins, Superadmins

1. **Student Creation**
   - Collect basic information (name, email, phone)
   - Configure payment plan (installment options)
   - Generate secure login credentials
   - Create student profile and learning records

2. **Payment Setup**
   - Configure installment schedule
   - Generate initial invoice
   - Process first payment (if applicable)
   - Set up automated payment reminders

3. **Account Activation**
   - Send welcome email with credentials
   - Grant LMS access
   - Initialize learning progress tracking
   - Assign mentor (if configured)

### Administrative Features

#### Student Search and Filtering
- Name, email, phone, student ID search
- Status filtering (Active, Inactive, Suspended)
- Payment status filtering
- Mentor assignment filtering
- Date range filtering`,
    };
    
    return contents[filePath] || `# ${filePath.split('/').pop()?.replace('.md', '')}

This documentation file is currently being loaded. Content will be available soon.

## Overview

This section contains detailed information about the ${filePath.split('/').pop()?.replace('.md', '').replace('-', ' ')} functionality.

## Key Features

- Comprehensive documentation
- Step-by-step guides
- Code examples
- Best practices

## Getting Started

Please refer to the main documentation index for getting started guides and setup instructions.`;
  };

  const filterFiles = (files: DocumentFile[], query: string): DocumentFile[] => {
    if (!query.trim()) return files;
    
    const lowerQuery = query.toLowerCase();
    return files.filter(file => {
      const matchesName = file.name.toLowerCase().includes(lowerQuery);
      const matchesTitle = file.title.toLowerCase().includes(lowerQuery);
      const hasMatchingChildren = file.children?.some(child => 
        child.name.toLowerCase().includes(lowerQuery) || 
        child.title.toLowerCase().includes(lowerQuery)
      );
      
      return matchesName || matchesTitle || hasMatchingChildren;
    }).map(file => ({
      ...file,
      children: file.children?.filter(child =>
        child.name.toLowerCase().includes(lowerQuery) ||
        child.title.toLowerCase().includes(lowerQuery)
      )
    }));
  };

  useEffect(() => {
    loadDocumentationFiles();
  }, [loadDocumentationFiles]);

  useEffect(() => {
    if (selectedFile) {
      loadMarkdownContent(selectedFile);
    }
  }, [selectedFile, loadMarkdownContent]);

  const filteredFiles = filterFiles(files, searchQuery);

  if (loading && !markdownContent) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
          <p className="text-lg font-medium">Loading documentation...</p>
          <p className="text-sm text-muted-foreground">Please wait while we fetch the latest docs</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            📚 Documentation Center
          </h1>
          <p className="text-muted-foreground mt-1">
            Complete system documentation and guides
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          {filteredFiles.length} documents
        </Badge>
      </div>

      {/* Breadcrumbs */}
      <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
        {breadcrumbs.map((crumb, index) => (
          <React.Fragment key={crumb.path}>
            {index > 0 && <ChevronRight className="h-4 w-4" />}
            <span className={index === breadcrumbs.length - 1 ? "text-foreground font-medium" : "hover:text-foreground cursor-pointer"}>
              {crumb.name}
            </span>
          </React.Fragment>
        ))}
      </nav>

      <div className="grid grid-cols-12 gap-6">
        {/* Sidebar */}
        <div className={`${sidebarOpen ? 'col-span-3' : 'col-span-1'} transition-all duration-300`}>
          <Card className="h-[calc(100vh-200px)]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                {sidebarOpen && (
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    Documentation
                  </CardTitle>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="h-8 w-8 p-0"
                >
                  {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                </Button>
              </div>
              {sidebarOpen && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search docs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              )}
            </CardHeader>
            {sidebarOpen && (
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-320px)]">
                  <DocumentationSidebar
                    files={filteredFiles}
                    selectedFile={selectedFile}
                    onFileSelect={setSelectedFile}
                  />
                </ScrollArea>
              </CardContent>
            )}
          </Card>
        </div>

        {/* Main Content */}
        <div className={`${sidebarOpen ? 'col-span-9' : 'col-span-11'} transition-all duration-300`}>
          <Card className="h-[calc(100vh-200px)]">
            <CardContent className="p-0">
              <ScrollArea className="h-full">
                <div className="p-6">
                  <MarkdownRenderer content={markdownContent} />
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}