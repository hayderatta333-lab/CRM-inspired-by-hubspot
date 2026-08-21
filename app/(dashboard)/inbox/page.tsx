export const dynamic = "force-dynamic";
import { getInboxThreads } from "@/lib/actions/inbox";
import { InboxPanel } from "@/components/shared/inbox-panel";

export default async function InboxPage() {
  const result = await getInboxThreads();
  const threads = result.success ? result.data : [];

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <InboxPanel initialThreads={threads} />
    </div>
  );
}
