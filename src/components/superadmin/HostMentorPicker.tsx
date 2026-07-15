import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Search, Shield, ShieldCheck, GraduationCap, User as UserIcon, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface HostUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface HostMentorPickerProps {
  users: HostUser[];
  value: string;
  onChange: (userId: string) => void;
  placeholder?: string;
}

const ROLE_META: Record<string, { label: string; icon: any; tone: string }> = {
  superadmin: { label: 'Superadmin', icon: ShieldCheck, tone: 'bg-violet-500/10 text-violet-600 dark:text-violet-300 ring-violet-500/20' },
  admin: { label: 'Admin', icon: Shield, tone: 'bg-sky-500/10 text-sky-600 dark:text-sky-300 ring-sky-500/20' },
  mentor: { label: 'Mentor', icon: GraduationCap, tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 ring-emerald-500/20' },
};

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('') || '?';
}

function avatarTone(name: string): string {
  const palette = [
    'bg-rose-500/15 text-rose-600 dark:text-rose-300',
    'bg-amber-500/15 text-amber-600 dark:text-amber-300',
    'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
    'bg-sky-500/15 text-sky-600 dark:text-sky-300',
    'bg-violet-500/15 text-violet-600 dark:text-violet-300',
    'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-300',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

export function HostMentorPicker({ users, value, onChange, placeholder = 'Select a mentor, admin, or superadmin' }: HostMentorPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = users.find(u => u.id === value);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? users.filter(u =>
          u.full_name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.role.toLowerCase().includes(q))
      : users;
    const order: Array<keyof typeof ROLE_META> = ['mentor', 'admin', 'superadmin'];
    const buckets: Record<string, HostUser[]> = {};
    for (const u of filtered) {
      const key = order.includes(u.role as any) ? u.role : 'other';
      (buckets[key] ||= []).push(u);
    }
    for (const k of Object.keys(buckets)) {
      buckets[k].sort((a, b) => a.full_name.localeCompare(b.full_name));
    }
    return { order, buckets, count: filtered.length };
  }, [users, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-10 bg-background font-normal"
        >
          {selected ? (
            <span className="flex items-center gap-2 min-w-0">
              <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold shrink-0', avatarTone(selected.full_name))}>
                {getInitials(selected.full_name)}
              </span>
              <span className="truncate text-sm">{selected.full_name}</span>
              <RolePill role={selected.role} />
            </span>
          ) : (
            <span className="text-muted-foreground text-sm truncate">{placeholder}</span>
          )}
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[320px] bg-background border shadow-lg z-50" align="start">
        <div className="p-2 border-b bg-muted/30">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, email, or role…"
              className="w-full pl-8 pr-8 h-9 rounded-md bg-background border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto py-1">
          {groups.count === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              <UserIcon className="h-6 w-6 mx-auto mb-2 opacity-40" />
              No matches for "{query}"
            </div>
          ) : (
            groups.order.map((roleKey) => {
              const list = groups.buckets[roleKey];
              if (!list?.length) return null;
              const meta = ROLE_META[roleKey];
              const RoleIcon = meta.icon;
              return (
                <div key={roleKey} className="pb-1">
                  <div className="flex items-center gap-1.5 px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <RoleIcon className="h-3 w-3" />
                    {meta.label}s
                    <span className="ml-auto text-[10px] text-muted-foreground/70 font-normal normal-case tracking-normal">{list.length}</span>
                  </div>
                  {list.map((u) => {
                    const isSelected = u.id === value;
                    return (
                      <button
                        type="button"
                        key={u.id}
                        onClick={() => { onChange(u.id); setOpen(false); setQuery(''); }}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/60 transition-colors',
                          isSelected && 'bg-primary/5'
                        )}
                      >
                        <span className={cn('flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold shrink-0', avatarTone(u.full_name))}>
                          {getInitials(u.full_name)}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{u.full_name}</span>
                            <RolePill role={u.role} />
                          </span>
                          <span className="block text-xs text-muted-foreground truncate">{u.email}</span>
                        </span>
                        {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        <div className="px-3 py-2 border-t bg-muted/30 text-[11px] text-muted-foreground flex items-center justify-between">
          <span>{groups.count} of {users.length} people</span>
          <span className="opacity-70">↑↓ to browse · Enter to select</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function RolePill({ role }: { role: string }) {
  const meta = ROLE_META[role];
  if (!meta) return <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{role}</Badge>;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-1.5 py-0 text-[10px] font-medium ring-1 ring-inset', meta.tone)}>
      {meta.label}
    </span>
  );
}
