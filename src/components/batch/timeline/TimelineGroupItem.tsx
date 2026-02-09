import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Video, Radio, Edit, Trash2, GripVertical, FileText,
  ChevronDown, ChevronRight
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import type { TimelineItem, TimelineItemType } from '@/hooks/useBatchTimeline';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface TimelineGroupItemProps {
  group: {
    id: string;
    label: string;
    icon: React.ReactNode;
    items: TimelineItem[];
  };
  isCollapsed: boolean;
  batchStartDate?: string;
  onToggle: () => void;
  onEdit: (item: TimelineItem) => void;
  onDelete: (itemId: string) => void;
  onDeleteGroup: (groupId: string, items: TimelineItem[]) => void;
}

export function TimelineGroupItem({
  group,
  isCollapsed,
  batchStartDate,
  onToggle,
  onEdit,
  onDelete,
  onDeleteGroup,
}: TimelineGroupItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: group.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const getDeployDate = (offsetDays: number) => {
    if (!batchStartDate) return '-';
    return format(addDays(new Date(batchStartDate), offsetDays), 'MMM dd, yyyy');
  };

  const getItemIcon = (type: TimelineItemType) => {
    return type === 'RECORDING' ? <Video className="w-4 h-4" /> : <Radio className="w-4 h-4" />;
  };

  return (
    <div ref={setNodeRef} style={style} className="border rounded-lg overflow-hidden">
      <div className="flex items-center bg-muted/30 hover:bg-muted/50 transition-colors">
        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="p-3 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
        >
          <GripVertical className="w-4 h-4" />
        </div>

        <button
          onClick={onToggle}
          className="flex-1 flex items-center gap-3 p-3 pl-0 text-left"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {group.icon}
          <span className="font-medium">{group.label}</span>
          <Badge variant="secondary" className="ml-auto">{group.items.length}</Badge>
        </button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 mr-2 text-destructive hover:text-destructive"
          title={`Delete all items in "${group.label}"`}
          onClick={(e) => {
            e.stopPropagation();
            onDeleteGroup(group.id, group.items);
          }}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {!isCollapsed && (
        <div className="divide-y">
          {group.items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-4 p-3 px-4 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-2 text-muted-foreground min-w-[80px]">
                <span className="font-mono text-sm">Day {item.drip_offset_days}</span>
              </div>

              <div className="flex items-center gap-2">
                {getItemIcon(item.type)}
                <Badge variant={item.type === 'RECORDING' ? 'default' : 'secondary'} className="text-xs">
                  {item.type === 'RECORDING' ? 'Rec' : 'Live'}
                </Badge>
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm truncate">{item.title}</h4>
                <p className="text-xs text-muted-foreground">
                  Deploys: {getDeployDate(item.drip_offset_days)}
                  {item.type === 'LIVE_SESSION' && item.start_datetime && (
                    <> • {format(new Date(item.start_datetime), 'MMM dd, h:mm a')}</>
                  )}
                  {item.assignment && (
                    <> • <FileText className="w-3 h-3 inline" /> {item.assignment.name}</>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(item)}>
                  <Edit className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => onDelete(item.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
