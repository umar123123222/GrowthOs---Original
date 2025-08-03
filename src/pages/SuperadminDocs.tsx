import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RoleGuard } from '@/components/RoleGuard';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { FileText, Folder, FolderOpen, ArrowLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Import all documentation files dynamically
const docFiles = import.meta.glob('/docs/**/*.md', { 
  as: 'raw',
  eager: false 
});

interface DocFile {
  path: string;
  name: string;
  isDirectory: boolean;
  children?: DocFile[];
  content?: string;
}

export default function SuperadminDocs() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [docTree, setDocTree] = useState<DocFile[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [docContent, setDocContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    buildDocTree();
  }, []);

  useEffect(() => {
    if (slug) {
      loadDocument(slug);
    } else {
      setSelectedDoc(null);
      setDocContent('');
    }
  }, [slug]);

  const buildDocTree = () => {
    const tree: DocFile[] = [];
    const paths = Object.keys(docFiles);

    paths.forEach(fullPath => {
      const path = fullPath.replace('/docs/', '');
      const parts = path.split('/');
      let currentLevel = tree;

      parts.forEach((part, index) => {
        const isLast = index === parts.length - 1;
        const existing = currentLevel.find(item => item.name === part);

        if (existing) {
          if (!isLast && existing.children) {
            currentLevel = existing.children;
          }
        } else {
          const newItem: DocFile = {
            path: isLast ? path : parts.slice(0, index + 1).join('/'),
            name: part,
            isDirectory: !isLast,
            children: isLast ? undefined : []
          };

          currentLevel.push(newItem);
          
          if (!isLast && newItem.children) {
            currentLevel = newItem.children;
          }
        }
      });
    });

    setDocTree(tree);
    setLoading(false);
  };

  const loadDocument = async (docPath: string) => {
    try {
      const fullPath = `/docs/${docPath}`;
      const loader = docFiles[fullPath];
      
      if (loader) {
        const content = await loader();
        setDocContent(content);
        setSelectedDoc(docPath);
      } else {
        setDocContent('# Document Not Found\n\nThe requested document could not be found.');
        setSelectedDoc(docPath);
      }
    } catch (error) {
      console.error('Error loading document:', error);
      setDocContent('# Error Loading Document\n\nThere was an error loading the requested document.');
      setSelectedDoc(docPath);
    }
  };

  const renderDocTree = (items: DocFile[], level = 0) => {
    return items.map((item, index) => (
      <div key={item.path} className={`ml-${level * 4}`}>
        {item.isDirectory ? (
          <div className="py-1">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Folder className="h-4 w-4" />
              {item.name}
            </div>
            {item.children && (
              <div className="mt-1">
                {renderDocTree(item.children, level + 1)}
              </div>
            )}
          </div>
        ) : (
          <Button
            variant="ghost"
            className={`w-full justify-start py-1 px-2 h-auto text-sm ${
              selectedDoc === item.path ? 'bg-muted' : ''
            }`}
            onClick={() => navigate(`/superadmin/docs/${item.path}`)}
          >
            <FileText className="h-4 w-4 mr-2" />
            {item.name.replace('.md', '')}
          </Button>
        )}
      </div>
    ));
  };

  if (loading) {
    return (
      <RoleGuard allowedRoles={['superadmin']}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-lg">Loading documentation...</div>
        </div>
      </RoleGuard>
    );
  }

  return (
    <RoleGuard allowedRoles={['superadmin']}>
      <div className="container mx-auto p-6 h-screen flex gap-6">
        {/* Sidebar - Document Tree */}
        <Card className="w-80 h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Documentation
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-180px)] px-4">
              {docTree.length > 0 ? (
                renderDocTree(docTree)
              ) : (
                <div className="text-sm text-muted-foreground">
                  No documentation files found.
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Main Content */}
        <Card className="flex-1 h-full">
          <CardHeader>
            <div className="flex items-center gap-2">
              {selectedDoc && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/superadmin/docs')}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Overview
                </Button>
              )}
              <CardTitle>
                {selectedDoc ? selectedDoc.replace('.md', '') : 'Project Documentation'}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-180px)] px-6 pb-6">
              {selectedDoc && docContent ? (
                <div className="prose prose-slate max-w-none dark:prose-invert">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({children}) => <h1 className="text-3xl font-bold mb-6 text-foreground">{children}</h1>,
                      h2: ({children}) => <h2 className="text-2xl font-semibold mb-4 mt-8 text-foreground">{children}</h2>,
                      h3: ({children}) => <h3 className="text-xl font-semibold mb-3 mt-6 text-foreground">{children}</h3>,
                      p: ({children}) => <p className="mb-4 text-foreground leading-7">{children}</p>,
                      code: ({children, ...props}) => {
                        const isInline = !props.className?.includes('language-');
                        return isInline ? (
                          <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>
                        ) : (
                          <code className="block bg-muted p-4 rounded-lg text-sm font-mono overflow-x-auto">{children}</code>
                        );
                      },
                      ul: ({children}) => <ul className="mb-4 ml-6 list-disc">{children}</ul>,
                      ol: ({children}) => <ol className="mb-4 ml-6 list-decimal">{children}</ol>,
                      li: ({children}) => <li className="mb-1">{children}</li>,
                      blockquote: ({children}) => (
                        <blockquote className="border-l-4 border-primary pl-4 italic my-4 text-muted-foreground">
                          {children}
                        </blockquote>
                      ),
                      table: ({children}) => (
                        <div className="overflow-x-auto my-4">
                          <table className="w-full border-collapse border border-border">
                            {children}
                          </table>
                        </div>
                      ),
                      th: ({children}) => (
                        <th className="border border-border px-4 py-2 bg-muted font-semibold text-left">
                          {children}
                        </th>
                      ),
                      td: ({children}) => (
                        <td className="border border-border px-4 py-2">
                          {children}
                        </td>
                      ),
                    }}
                  >
                    {docContent}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">Welcome to Documentation</h3>
                  <p className="text-muted-foreground">
                    Select a document from the sidebar to view its contents.
                  </p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </RoleGuard>
  );
}