import type { ReactNode } from 'react';
export function ToolPage({ title, children, notice }: { title: string; children: ReactNode; notice?: ReactNode }) {
  return <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6"><div className="mx-auto max-w-5xl space-y-4"><h1 className="text-xl font-semibold">{title}</h1>{notice}{children}</div></main>;
}
