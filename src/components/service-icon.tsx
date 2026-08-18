"use client";

import Image from "next/image";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import type { Service } from "@/lib/dashboard-types";
import { cn } from "@/lib/utils";

export function ServiceIcon({
  service,
  compact = false,
  className,
}: {
  service: Pick<Service, "name" | "iconType" | "iconValue" | "faviconCache">;
  compact?: boolean;
  className?: string;
}) {
  const size = compact ? 28 : 32;
  const classes = cn(compact ? "size-7 rounded-md" : "size-8 rounded-lg", "shrink-0", className);

  if (service.faviconCache) {
    return (
      <Image
        src={`/api/icon/${service.faviconCache.replace("icons/", "")}`}
        alt=""
        width={size}
        height={size}
        unoptimized
        className={cn(classes, "object-contain")}
      />
    );
  }
  if (service.iconType === "simple-icon" && service.iconValue) {
    return (
      <Image
        src={`/api/icon/simple/${encodeURIComponent(service.iconValue)}`}
        alt=""
        width={size}
        height={size}
        unoptimized
        className={cn(classes, "object-contain p-1")}
      />
    );
  }
  if (service.iconType === "lucide" && service.iconValue) {
    return (
      <span className={cn(classes, "flex items-center justify-center bg-primary/10 text-primary")} aria-hidden="true">
        <DynamicIcon name={service.iconValue as IconName} />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(classes, "flex items-center justify-center bg-primary/10 text-xs font-bold text-primary")}
    >
      {service.iconType === "emoji"
        ? service.iconValue || "🔗"
        : service.iconValue?.slice(0, 2) || service.name[0]?.toUpperCase() || "?"}
    </span>
  );
}
