"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { useLearnerProfile } from "../hooks/useLearnerProfile";
import { localize, useLearningLanguage } from "../lib/language";

type NotificationMenuProps = { placement: "dashboard" | "topbar" };

export function NotificationMenu({ placement }: NotificationMenuProps) {
  const { profile, markNotificationsRead } = useLearnerProfile();
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState(false);
  const [highlightUnread, setHighlightUnread] = useState(false);
  const language = useLearningLanguage();
  const t = (english: string, chinese: string) => localize(language, english, chinese);

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
        <PopoverTrigger render={<Button className="notification-button" variant="ghost" size="icon" type="button" aria-label={read ? t("Notifications", "通知") : t("Notifications, new items", "通知，有新消息")} />}>
          <span className="bell-icon" aria-hidden="true" />
          {!read && <span className="notification-dot" />}
        </PopoverTrigger>
        <PopoverContent className={`notification-popover ${placement === "topbar" ? "topbar-notification-popover" : ""}`} align="end" sideOffset={8}>
          <header><PopoverTitle>{t("Notifications", "通知")}</PopoverTitle><Button variant="ghost" size="icon-sm" type="button" onClick={close} aria-label={t("Close notifications", "关闭通知")}>×</Button></header>
          {profile.notifications.map((notification) => <p className={highlightUnread ? "unread" : ""} key={notification}>{highlightUnread && <Badge className="new-label">{t("New", "新")}</Badge>}{notification}</p>)}
        </PopoverContent>
      </Popover>
    </div>
  );
}
