import { redirect } from "next/navigation";
import { getCurrentUser, getOrgContext } from "@/lib/auth/session";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const ctx = await getOrgContext();
  if (ctx) redirect("/dashboard"); // already belongs to an org — nothing to onboard

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <OnboardingForm />
      </div>
    </div>
  );
}
