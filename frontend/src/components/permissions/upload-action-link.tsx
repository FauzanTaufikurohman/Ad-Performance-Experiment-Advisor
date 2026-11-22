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
    return null;
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
