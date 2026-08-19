import { requireRole } from "@/lib/auth/session";
import { listApiKeys } from "@/lib/actions/integrations";
import { listFacebookConnections } from "@/lib/actions/facebook";
import { IntegrationsPanel } from "@/components/settings/integrations-panel";
import { FacebookPanel } from "@/components/settings/facebook-panel";

export default async function IntegrationsSettingsPage() {
  await requireRole(["admin"]);
  const result = await listApiKeys();
  const keys = result.success ? result.data : [];

  const fbResult = await listFacebookConnections();
  const fbConnections = fbResult.success ? fbResult.data : [];

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-zinc-900">Integrations</h1>
        <p className="text-sm text-zinc-500">
          Connect n8n, Facebook, or other automation tools to this CRM.
        </p>
      </div>
      <IntegrationsPanel initialKeys={keys} />
      <FacebookPanel initialConnections={fbConnections} />
    </div>
  );
}
