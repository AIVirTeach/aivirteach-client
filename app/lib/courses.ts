export type DemoCourse = {
  id: string;
  title: string;
  category: string;
  description: string;
  level: string;
  duration: string;
  lessons: number;
  tone: "blue" | "violet" | "cyan" | "indigo";
};

export const activeCourseStorageKey = "aivirteach.activeCourse.v1";

export const courseCatalog: DemoCourse[] = [
  {
    id: "n8n-agent-builder",
    title: "Build an Agent using n8n",
    category: "AI Automation",
    description: "Design, connect, and deploy a practical AI agent with visual workflows.",
    level: "Intermediate",
    duration: "6 hours",
    lessons: 12,
    tone: "blue",
  },
  {
    id: "python-data-analysis",
    title: "Python for Data Analysis",
    category: "Data Skills",
    description: "Use Python and Pandas to inspect, filter, and transform real datasets.",
    level: "Beginner",
    duration: "8 hours",
    lessons: 16,
    tone: "cyan",
  },
  {
    id: "prompt-engineering",
    title: "Prompt Engineering Fundamentals",
    category: "Generative AI",
    description: "Write reliable prompts, evaluate responses, and build reusable prompt patterns.",
    level: "Beginner",
    duration: "4 hours",
    lessons: 10,
    tone: "violet",
  },
  {
    id: "ai-workflow-automation",
    title: "AI Workflow Automation",
    category: "Applied AI",
    description: "Combine models, tools, and structured data into dependable automated workflows.",
    level: "Advanced",
    duration: "10 hours",
    lessons: 18,
    tone: "indigo",
  },
];

export function activateCourse(courseId: string) {
  window.localStorage.setItem(activeCourseStorageKey, courseId);
}

export function readActiveCourse() {
  const courseId = window.localStorage.getItem(activeCourseStorageKey);
  return courseCatalog.find((course) => course.id === courseId) ?? null;
}
