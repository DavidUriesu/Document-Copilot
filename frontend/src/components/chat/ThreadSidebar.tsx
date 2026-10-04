import { FileSearch, MessageSquareText, Plus } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { AccountMenu } from '@/components/app/AccountMenu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar'
import type { ChatThread } from '@/lib/chat'

interface ThreadSidebarProps {
  threads: ChatThread[]
  isCreating: boolean
  isLoading: boolean
  onCreate: () => void
}

interface ThreadGroup {
  label: string
  threads: ChatThread[]
}

const day = 24 * 60 * 60 * 1000

function groupThreads(threads: ChatThread[]): ThreadGroup[] {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const groups: ThreadGroup[] = [
    { label: 'Today', threads: [] },
    { label: 'Previous 7 days', threads: [] },
    { label: 'Older', threads: [] },
  ]

  for (const thread of threads) {
    const updatedAt = new Date(thread.updatedAt).getTime()
    if (updatedAt >= startOfToday) groups[0].threads.push(thread)
    else if (updatedAt >= startOfToday - 7 * day) groups[1].threads.push(thread)
    else groups[2].threads.push(thread)
  }

  return groups.filter((group) => group.threads.length > 0)
}

export function ThreadSidebar({ threads, isCreating, isLoading, onCreate }: ThreadSidebarProps) {
  const location = useLocation()
  const { setOpenMobile } = useSidebar()
  const groups = useMemo(() => groupThreads(threads), [threads])

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3 px-3 pb-3 pt-4">
        <Link
          className="flex h-8 items-center gap-2 overflow-hidden rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          onClick={() => setOpenMobile(false)}
          to="/chats"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-foreground text-background">
            <FileSearch className="size-4" />
          </span>
          <span className="truncate text-sm font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            Document Copilot
          </span>
        </Link>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/85 hover:text-sidebar-primary-foreground"
              disabled={isCreating}
              onClick={onCreate}
              tooltip="New conversation"
            >
              <Plus />
              <span>{isCreating ? 'Creating…' : 'New conversation'}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        {isLoading ? (
          <SidebarGroup>
            <SidebarGroupLabel>Conversations</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {Array.from({ length: 5 }, (_, index) => (
                  <SidebarMenuSkeleton key={index} showIcon />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : groups.length === 0 ? (
          <div className="px-5 py-8 text-center group-data-[collapsible=icon]:hidden">
            <MessageSquareText className="mx-auto size-5 text-muted-foreground" />
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Your research conversations will appear here.
            </p>
          </div>
        ) : (
          groups.map((group) => (
            <SidebarGroup className="pb-0" key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.threads.map((thread) => {
                    const to = `/chats/${thread.id}`
                    return (
                      <SidebarMenuItem key={thread.id}>
                        <SidebarMenuButton
                          isActive={location.pathname === to}
                          render={<Link onClick={() => setOpenMobile(false)} to={to} />}
                          tooltip={thread.title}
                        >
                          <MessageSquareText />
                          <span>{thread.title}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))
        )}
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter>
        <SidebarMenu>
          <AccountMenu />
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
