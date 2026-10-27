import { currentUser } from "@/lib/auth";
import { workspace } from "@/lib/workspace";
import { AuthScreen } from "@/components/auth-screen";
import { WorkspaceApp } from "@/components/workspace-app";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default async function Page() {
  const user = await currentUser();
  if (user) return <WorkspaceApp initial={await workspace(user)} />;
  return <AuthScreen />;
}
