"use client";

import { type FormEvent, useEffect, useState } from "react";
import { SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { courseCatalog } from "../lib/courses";
import { localize, useLearningLanguage } from "../lib/language";

const searchableItems = courseCatalog.flatMap((course) => [course.title, course.category, course.description, course.level]);

export function TopbarSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [feedback, setFeedback] = useState("");
  const language = useLearningLanguage();
  const t = (english: string, chinese: string) => localize(language, english, chinese);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(""), 5000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      setFeedback(t("Enter a course or skill to search.", "请输入要搜索的课程或技能。"));
      return;
    }

    const match = searchableItems.find((item) => item.toLowerCase().includes(normalizedQuery.toLowerCase()));
    setFeedback(match ? t(`Found: ${match}`, `找到：${match}`) : t(`No results for “${normalizedQuery}”.`, `未找到“${normalizedQuery}”的结果。`));
  }

  return (
    <Popover open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) setFeedback(""); }}>
      <PopoverTrigger render={<Button className="topbar-search" variant="ghost" size="icon" type="button" aria-label={t("Open search", "打开搜索")} />}>
        <SearchIcon aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent className="topbar-search-popover" align="end" sideOffset={19}>
        <form className="search-box topbar-search-popover-form" role="search" onSubmit={submitSearch}>
          <Input autoFocus aria-label={t("Search courses and skills", "搜索课程和技能")} placeholder={t("Enter to search...", "输入内容进行搜索……")} value={query} onChange={(event) => { setQuery(event.target.value); setFeedback(""); }} />
        </form>
        {feedback && <output className="search-feedback" aria-live="polite">{feedback}</output>}
      </PopoverContent>
    </Popover>
  );
}
