import { ChevronsUpDown, LogOut } from 'lucide-react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

function initials(email: string): string {
  return email.slice(0, 2).toUpperCase()
}

export function AccountMenu() {
  const { session } = useAuth()
  const email = session?.user.email ?? 'Signed-in analyst'

  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <SidebarMenuButton
              className="h-11 group-data-[collapsible=icon]:p-1!"
              size="lg"
              tooltip="Account"
            />
          }
        >
          <Avatar className="rounded-md" size="sm">
            <AvatarFallback className="rounded-md bg-foreground text-[10px] font-semibold text-background">
              {initials(email)}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1 truncate text-left text-xs font-medium">
            {email}
          </span>
          <ChevronsUpDown className="ml-auto size-3.5 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" sideOffset={8}>
          <DropdownMenuGroup>
            <DropdownMenuLabel className="px-2 py-2">
              <span className="block font-medium text-foreground">Analyst account</span>
              <span className="mt-0.5 block truncate font-normal">{email}</span>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => void supabase.auth.signOut()}>
            <LogOut />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}
