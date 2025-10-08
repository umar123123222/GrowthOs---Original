import { Home, FileCheck, Video, BookOpen, FileText } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

const mentorMenuItems = [
  { title: 'Overview', url: '/mentor-dashboard', icon: Home, exact: true },
  { title: 'Submissions', url: '/mentor-dashboard/submissions', icon: FileCheck },
  { title: 'Recordings', url: '/mentor-dashboard/recordings', icon: Video },
  { title: 'Modules', url: '/mentor-dashboard/modules', icon: BookOpen },
  { title: 'Assignments', url: '/mentor-dashboard/assignments', icon: FileText },
];

export function MentorSidebar() {
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  const getNavCls = (active: boolean) =>
    active 
      ? 'bg-purple-100 text-purple-900 font-semibold hover:bg-purple-200' 
      : 'hover:bg-muted/50';

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Mentor Hub</SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {mentorMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      end={item.exact}
                      className={({ isActive }) => getNavCls(isActive)}
                    >
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span className="ml-2">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
