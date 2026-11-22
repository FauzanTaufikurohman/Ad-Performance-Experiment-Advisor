import { Suspense } from "react";
import AcceptInvitationForm from "./invite-accept-form";

type AcceptInvitationPageProps = {
  searchParams: Promise<{ token?: string | string[] }>;
};

export default function AcceptInvitationPage({
  searchParams,
}: AcceptInvitationPageProps) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
          <p role="status" className="text-sm text-slate-700">
            Memuat undangan...
          </p>
        </main>
      }
    >
      <InvitationContent searchParams={searchParams} />
    </Suspense>
  );
}

async function InvitationContent({
  searchParams,
}: AcceptInvitationPageProps) {
  const { token } = await searchParams;
  return (
    <AcceptInvitationForm
      invitationToken={Array.isArray(token) ? token[0] ?? "" : token ?? ""}
    />
  );
}
