import AppShell from "@/components/AppShell";
import QueryProvider from "@/components/QueryProvider";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <AppShell>{children}</AppShell>
    </QueryProvider>
  );
}