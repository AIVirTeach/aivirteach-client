"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { useLearnerProfile } from "../hooks/useLearnerProfile";

type NotificationMenuProps = { placement: "dashboard" | "topbar" };

export function NotificationMenu({ placement }: NotificationMenuProps) {
  const { profile, markNotificationsRead } = useLearnerProfile();
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState(false);
  const [highlightUnread, setHighlightUnread] = useState(false);

  function changeOpen(nextOpen: boolean) {
    if (!nextOpen) {
      setOpen(false);
      setHighlightUnread(false);
      return;
    }

    setHighlightUnread(!read && profile.notifications.length > 0);
    setRead(true);
    void markNotificationsRead();
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setHighlightUnread(false);
  }

  return (
    <div className={`notification-wrap ${placement === "topbar" ? "topbar-notifications" : ""}`}>
      <Popover open={open} onOpenChange={changeOpen}>
        <PopoverTrigger render={<Button className="notification-button" variant="ghost" size="icon" type="button" aria-label={read ? "Notifications" : "Notifications, new items"} />}>
          <span className="bell-icon" aria-hidden="true" />
          {!read && <span className="notification-dot" />}
        </PopoverTrigger>
        <PopoverContent className={`notification-popover ${placement === "topbar" ? "topbar-notification-popover" : ""}`} align="end" sideOffset={8}>
          <header><PopoverTitle>Notifications</PopoverTitle><Button variant="ghost" size="icon-sm" type="button" onClick={close} aria-label="Close notifications">×</Button></header>
          {profile.notifications.map((notification) => <p className={highlightUnread ? "unread" : ""} key={notification}>{highlightUnread && <Badge className="new-label">New</Badge>}{notification}</p>)}
        </PopoverContent>
      </Popover>
    </div>
  );
}
