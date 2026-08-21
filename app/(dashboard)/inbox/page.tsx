export const dynamic = "force-dynamic";
import { getInboxThreads } from "@/lib/actions/inbox";
import { InboxPanel } from "@/components/shared/inbox-panel";

export default async function InboxPage() {
  const result = await getInboxThreads();
  const threads = result.ok ? result.data : [];

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <pre className="text-[10px] p-2 bg-yellow-50 overflow-auto max-h-48">
        {JSON.stringify(result, null, 2)}
      </pre>
      <InboxPanel initialThreads={threads} />
    </div>
  );
}
