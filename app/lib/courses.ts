export type DemoCourse = {
  id: string;
  title: string;
  category: string;
  description: string;
  level: string;
  duration: string;
  lessons: number;
  tone: "blue" | "violet" | "cyan" | "indigo";
  coverAssetId?: string;
};

export const activeCourseStorageKey = "aivirteach.activeCourse.v1";

export const courseCatalog: DemoCourse[] = [
  {
    id: "ai-daily-briefing",
    title: "Build an AI Daily Briefing with n8n",
    category: "AI Automation",
    description: "Collect, rank, summarize, and email the most important AI and technology news.",
    level: "Intermediate",
    duration: "6 hours",
    lessons: 12,
    tone: "blue",
  },
  {
    id: "ai-web-watcher-agent",
    title: "Build an AI Web Watcher Agent with n8n",
    category: "AI Automation",
    description: "Monitor a public webpage, detect meaningful changes, and send relevant alerts.",
    level: "Intermediate",
    duration: "9 hours",
    lessons: 11,
    tone: "indigo",
  },
];

export function activateCourse(courseId: string) {
  window.localStorage.setItem(activeCourseStorageKey, courseId);
}

export function clearActiveCourse(courseId?: string) {
  window.localStorage.removeItem(activeCourseStorageKey);
  if (courseId) {
    window.localStorage.removeItem(`aivirteach.course.lesson.${courseId}`);
    window.localStorage.removeItem(`aivirteach.lab.activeSeconds.${courseId}`);
  }
}

export function readActiveCourse() {
  const courseId = window.localStorage.getItem(activeCourseStorageKey);
  return courseCatalog.find((course) => course.id === courseId) ?? null;
}
