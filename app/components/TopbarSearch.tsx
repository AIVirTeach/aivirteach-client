"use client";

import { type FormEvent, useEffect, useState } from "react";
import { SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { courseCatalog } from "../lib/courses";

const searchableItems = courseCatalog.flatMap((course) => [course.title, course.category, course.description, course.level]);

export function TopbarSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(""), 5000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      setFeedback("Enter a course or skill to search.");
      return;
    }

    const match = searchableItems.find((item) => item.toLowerCase().includes(normalizedQuery.toLowerCase()));
    setFeedback(match ? `Found: ${match}` : `No results for “${normalizedQuery}”.`);
  }

  return (
    <Popover open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) setFeedback(""); }}>
      <PopoverTrigger render={<Button className="topbar-search" variant="ghost" size="icon" type="button" aria-label="Open search" />}>
        <SearchIcon aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent className="topbar-search-popover" align="end" sideOffset={19}>
        <form className="search-box topbar-search-popover-form" role="search" onSubmit={submitSearch}>
          <Input autoFocus aria-label="Search courses and skills" placeholder="Enter to search..." value={query} onChange={(event) => { setQuery(event.target.value); setFeedback(""); }} />
        </form>
        {feedback && <output className="search-feedback" aria-live="polite">{feedback}</output>}
      </PopoverContent>
    </Popover>
  );
}
