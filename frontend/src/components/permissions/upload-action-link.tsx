"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { canWriteCampaignData } from "@/lib/advisor";

type UploadActionLinkProps = {
  href?: string;
  className: string;
  children: ReactNode;
};

export default function UploadActionLink({
  href = "/uploads/new",
  className,
  children,
}: UploadActionLinkProps) {
  const { user } = useAuth();

  if (!canWriteCampaignData(user?.organization_role)) {
    return (
      <p role="note" className="mt-3 text-sm leading-6 text-slate-700">
        Anda dapat meninjau data. Minta Owner, Admin, atau tim marketing untuk
        mengunggah dataset.
      </p>
    );
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
