"use client";

import Link from "next/link";
import { triggerGuidanceBannerOnce } from "./GuidanceBanner";

export function GuidanceTriggerLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        triggerGuidanceBannerOnce();
      }}
    >
      {children}
    </Link>
  );
}
