import { FileSearch } from 'lucide-react'
import type { ReactNode } from 'react'

interface AuthShellProps {
  children: ReactNode
  description: string
  footer: ReactNode
  title: string
}

export function AuthShell({ children, description, footer, title }: AuthShellProps) {
  return (
    <main className="grid min-h-svh min-w-0 overflow-x-hidden bg-background lg:grid-cols-[0.85fr_1.15fr]">
      <section className="relative hidden overflow-hidden border-r bg-foreground p-10 text-background lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3 text-sm font-semibold">
          <span className="grid size-9 place-items-center rounded-md border border-background/20">
            <FileSearch className="size-4" />
          </span>
          Document Copilot
        </div>
        <div className="max-w-md">
          <p className="text-xs text-background/55">Driftwood Capital · Internal research</p>
          <p className="mt-5 text-4xl font-medium leading-[1.08] tracking-[-0.04em]">
            Read less.<br />Verify more.
          </p>
          <p className="mt-5 max-w-sm text-sm leading-6 text-background/60">
            Grounded answers across the filing corpus, with the exact source passage always one click away.
          </p>
        </div>
        <p className="text-xs text-background/45">Evidence-first research for analysts</p>
      </section>
      <section className="flex min-h-svh min-w-0 items-center justify-center overflow-x-hidden px-5 py-12 sm:px-10">
        <div className="w-full min-w-0 max-w-sm">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <span className="grid size-9 place-items-center rounded-md bg-foreground text-background">
              <FileSearch className="size-4" />
            </span>
            <span className="text-sm font-semibold">Document Copilot</span>
          </div>
          <p className="text-xs font-medium text-muted-foreground">Secure analyst access</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em]">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
          <div className="mt-8">{children}</div>
          <div className="mt-8 border-t pt-5 text-sm text-muted-foreground">{footer}</div>
        </div>
      </section>
    </main>
  )
}
