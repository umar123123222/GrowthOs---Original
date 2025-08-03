import React, { useState, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Hash, 
  List, 
  ChevronRight,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content: string;
}

interface TableOfContentsItem {
  id: string;
  title: string;
  level: number;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const [activeHeading, setActiveHeading] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<string>('');
  const [showToc, setShowToc] = useState(true);

  // Extract table of contents from markdown content
  const tableOfContents = useMemo(() => {
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const toc: TableOfContentsItem[] = [];
    let match;
    
    while ((match = headingRegex.exec(content)) !== null) {
      const level = match[1].length;
      const title = match[2].trim();
      const id = title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');
      
      toc.push({ id, title, level });
    }
    
    return toc;
  }, [content]);

  // Handle scroll to update active heading
  useEffect(() => {
    const handleScroll = () => {
      const headings = document.querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]');
      const scrollTop = window.scrollY;
      
      let current = '';
      headings.forEach((heading) => {
        const element = heading as HTMLElement;
        if (element.offsetTop <= scrollTop + 100) {
          current = element.id;
        }
      });
      
      setActiveHeading(current);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial call
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, [content]);

  // Copy code to clipboard
  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(''), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  // Scroll to heading
  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Custom components for markdown rendering
  const components = {
    // Headings with auto-generated IDs
    h1: ({ children, ...props }: any) => {
      const id = children?.toString()
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');
      return (
        <h1 
          id={id} 
          className="text-3xl font-bold mt-8 mb-4 text-foreground border-b pb-2" 
          {...props}
        >
          {children}
        </h1>
      );
    },
    h2: ({ children, ...props }: any) => {
      const id = children?.toString()
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');
      return (
        <h2 
          id={id} 
          className="text-2xl font-semibold mt-6 mb-3 text-foreground" 
          {...props}
        >
          {children}
        </h2>
      );
    },
    h3: ({ children, ...props }: any) => {
      const id = children?.toString()
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');
      return (
        <h3 
          id={id} 
          className="text-xl font-semibold mt-5 mb-2 text-foreground" 
          {...props}
        >
          {children}
        </h3>
      );
    },
    h4: ({ children, ...props }: any) => {
      const id = children?.toString()
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');
      return (
        <h4 
          id={id} 
          className="text-lg font-semibold mt-4 mb-2 text-foreground" 
          {...props}
        >
          {children}
        </h4>
      );
    },
    h5: ({ children, ...props }: any) => {
      const id = children?.toString()
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');
      return (
        <h5 
          id={id} 
          className="text-base font-semibold mt-3 mb-2 text-foreground" 
          {...props}
        >
          {children}
        </h5>
      );
    },
    h6: ({ children, ...props }: any) => {
      const id = children?.toString()
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');
      return (
        <h6 
          id={id} 
          className="text-sm font-semibold mt-3 mb-1 text-foreground" 
          {...props}
        >
          {children}
        </h6>
      );
    },
    
    // Paragraphs
    p: ({ children, ...props }: any) => (
      <p className="text-muted-foreground leading-relaxed mb-4" {...props}>
        {children}
      </p>
    ),
    
    // Links
    a: ({ href, children, ...props }: any) => (
      <a 
        href={href}
        className="text-primary hover:text-primary/80 underline inline-flex items-center gap-1"
        target={href?.startsWith('http') ? '_blank' : undefined}
        rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
        {...props}
      >
        {children}
        {href?.startsWith('http') && <ExternalLink className="h-3 w-3" />}
      </a>
    ),
    
    // Code blocks
    pre: ({ children, ...props }: any) => {
      const code = children?.props?.children || '';
      const language = children?.props?.className?.replace('language-', '') || '';
      
      return (
        <div className="relative group mb-4">
          <div className="flex items-center justify-between bg-muted px-4 py-2 rounded-t-lg border">
            <span className="text-sm font-mono text-muted-foreground">
              {language || 'code'}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => copyCode(code)}
            >
              {copiedCode === code ? (
                <Check className="h-3 w-3 text-green-600" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
          <pre 
            className="bg-card border border-t-0 rounded-b-lg p-4 overflow-x-auto text-sm"
            {...props}
          >
            {children}
          </pre>
        </div>
      );
    },
    
    // Inline code
    code: ({ inline, children, ...props }: any) => {
      if (inline) {
        return (
          <code 
            className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground"
            {...props}
          >
            {children}
          </code>
        );
      }
      return <code {...props}>{children}</code>;
    },
    
    // Lists
    ul: ({ children, ...props }: any) => (
      <ul className="list-disc list-inside mb-4 space-y-1 text-muted-foreground" {...props}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }: any) => (
      <ol className="list-decimal list-inside mb-4 space-y-1 text-muted-foreground" {...props}>
        {children}
      </ol>
    ),
    
    // Blockquotes
    blockquote: ({ children, ...props }: any) => (
      <blockquote 
        className="border-l-4 border-primary pl-4 my-4 italic text-muted-foreground bg-muted/20 py-2"
        {...props}
      >
        {children}
      </blockquote>
    ),
    
    // Tables
    table: ({ children, ...props }: any) => (
      <div className="overflow-x-auto mb-4">
        <table className="w-full border-collapse border border-border" {...props}>
          {children}
        </table>
      </div>
    ),
    th: ({ children, ...props }: any) => (
      <th 
        className="border border-border bg-muted px-4 py-2 text-left font-semibold text-foreground"
        {...props}
      >
        {children}
      </th>
    ),
    td: ({ children, ...props }: any) => (
      <td 
        className="border border-border px-4 py-2 text-muted-foreground"
        {...props}
      >
        {children}
      </td>
    ),
    
    // Horizontal rule
    hr: ({ ...props }: any) => (
      <Separator className="my-6" {...props} />
    )
  };

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Main Content */}
      <div className={cn("transition-all duration-300", showToc ? "col-span-9" : "col-span-12")}>
        <div className="prose prose-gray dark:prose-invert max-w-none">
          <ReactMarkdown
            components={components}
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight, rehypeRaw]}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>

      {/* Table of Contents */}
      {showToc && tableOfContents.length > 0 && (
        <div className="col-span-3">
          <Card className="sticky top-6">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <List className="h-4 w-4" />
                  On this page
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => setShowToc(false)}
                >
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
              
              <ScrollArea className="h-[calc(100vh-300px)]">
                <nav className="space-y-1">
                  {tableOfContents.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => scrollToHeading(item.id)}
                      className={cn(
                        "block w-full text-left text-sm py-1 px-2 rounded hover:bg-muted transition-colors",
                        activeHeading === item.id ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground",
                        item.level > 2 && "pl-4",
                        item.level > 3 && "pl-6"
                      )}
                      style={{ paddingLeft: `${(item.level - 1) * 12}px` }}
                    >
                      <div className="flex items-center gap-2">
                        <Hash className="h-3 w-3 opacity-50" />
                        <span className="truncate">{item.title}</span>
                      </div>
                    </button>
                  ))}
                </nav>
              </ScrollArea>
            </div>
          </Card>
        </div>
      )}
      
      {/* Show TOC button when hidden */}
      {!showToc && tableOfContents.length > 0 && (
        <div className="fixed right-6 top-1/2 transform -translate-y-1/2 z-50">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowToc(true)}
            className="shadow-lg"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}