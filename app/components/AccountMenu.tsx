"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useLearnerProfile } from "../hooks/useLearnerProfile";
import { api } from "../lib/api";
import { Avatar } from "./Avatar";

type AccountMenuProps = { placement: "sidebar" | "lab"; collapsed?: boolean; onVmEnv?: () => void };

export function AccountMenu({ placement, collapsed = false, onVmEnv }: AccountMenuProps) {
  const router = useRouter();
  const { profile, loading } = useLearnerProfile();
  if (loading) {
    return (
      <div className={`account-menu account-menu-${placement}`}>
        <div className="profile-block sidebar-profile-loading" role="status" aria-label="Loading learner profile">
          <Skeleton as="span" className="profile-loading-avatar" aria-hidden="true" />
          <span className="profile-summary" aria-hidden="true"><Skeleton as="i" /><Skeleton as="i" /><Skeleton as="i" /></span>
        </div>
      </div>
    );
  }

  return (
    <div className={`account-menu account-menu-${placement}`}>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button className="profile-block profile-trigger account-menu-trigger" variant="ghost" type="button" aria-label={collapsed ? `${profile.name} account menu` : undefined} />}>
          <Avatar size={placement === "lab" ? "medium" : "large"} name={profile.name} src={profile.avatar} />
          <span className="profile-summary">
            <strong>{profile.name}</strong>
            <span>{placement === "lab" ? profile.role : `${profile.plan} Learner`}</span>
            {placement === "sidebar" && <em>Level {profile.level}</em>}
          </span>
          <span className="account-menu-chevron" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="account-dropdown-shadcn" side={placement === "lab" ? "top" : "right"} align="end" sideOffset={8}>
          {placement === "lab" ? <>
            <DropdownMenuItem onClick={() => onVmEnv?.()}>VM Env</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" render={<Link className="account-menu-exit" href="/courses" />}>Exit Learning Lab</DropdownMenuItem>
          </> : <>
            <DropdownMenuItem render={<Link href="/settings/profile" />}>Profile Settings</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => void api.logout().finally(() => router.replace("/login"))}>Sign out</DropdownMenuItem>
          </>}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
