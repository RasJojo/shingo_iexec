"use client";

import Avatar from "boring-avatars";
import { cn } from "@/lib/utils";

const BEAM_COLORS = ["#22d3ee", "#7c3aed", "#0f172a", "#14b8a6", "#1e293b"];

interface WalletAvatarProps {
  address?: string | null;
  size?: number;
  className?: string;
}

export function WalletAvatar({
  address,
  size = 40,
  className,
}: WalletAvatarProps) {
  const seed = address && address.trim().length > 0 ? address : "unknown-wallet";

  return (
    <div
      className={cn(
        "inline-flex overflow-hidden rounded-full border border-white/15 bg-slate-900",
        className
      )}
      style={{ width: size, height: size }}
    >
      <Avatar
        size={size}
        name={seed}
        variant="beam"
        colors={BEAM_COLORS}
        square={false}
      />
    </div>
  );
}
