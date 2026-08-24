import generatedCourses from "./generated-admin-courses.json";

export type CourseVisibility = "public" | "private" | "hidden";
export type CourseStatus = "draft" | "published";
export type CourseLevel = "Beginner" | "Intermediate" | "Advanced";

export type AdminCourseLesson = {
  id: string;
  position: number;
  title: string;
  sourceRange?: { startLine: number; endLine: number };
  content: string;
  objectives: string[];
  activity: { type: string; prompt: string; completionType: string };
  assessmentIds: string[];
};

export type AdminCourseModule = {
  id: string;
  position: number;
  title: string;
  description: string;
  lessons: AdminCourseLesson[];
};

export type AdminAssessment = {
  id: string;
  type: string;
  question: string;
  options?: string[];
  criteria?: string[];
  answer: unknown;
  explanation: string;
};

export type AdminCourse = {
  schemaVersion: number;
  id: string;
  slug: string;
  version: number;
  status: CourseStatus;
  visibility: CourseVisibility;
  metadata: {
    title: string;
    shortTitle: string;
    category: string;
    description: string;
    level: CourseLevel;
    lessonCount: number;
    language: string;
    tags: string[];
  };
  outcomes: string[];
  requirements: string[];
  source: { format: string; path: string; encoding: string };
  assets: Array<{ id: string; type: string; path: string; alt: string; previewKey?: string }>;
  welcome: {
    schemaVersion: number;
    courseId: string;
    title: string;
    overviewAssetId?: string;
    overview: { heading: string; paragraphs: string[] };
    howItWorks: { heading: string; steps: Array<{ number: string; title: string; description: string }> };
    finalOutcome: { heading: string; description: string };
  };
  modules: AdminCourseModule[];
  assessments: AdminAssessment[];
};

export type CourseAdminStats = {
  totalLearners: number;
  lessonCompletions: number;
  totalCourses: number;
  publicCourses: number;
  privateCourses: number;
  hiddenCourses: number;
  totalLessons: number;
  draftCourses: number;
};

const courseStorageKey = "aivirteach.admin.courses.v1";
const courseSeed = generatedCourses as unknown as AdminCourse[];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function readCourses(): AdminCourse[] {
  if (typeof window === "undefined") return clone(courseSeed);
  const stored = window.localStorage.getItem(courseStorageKey);
  if (!stored) return clone(courseSeed);
  try {
    return JSON.parse(stored) as AdminCourse[];
  } catch {
    window.localStorage.removeItem(courseStorageKey);
    return clone(courseSeed);
  }
}

function writeCourses(courses: AdminCourse[]) {
  window.localStorage.setItem(courseStorageKey, JSON.stringify(courses));
}

function normalizeCourse(course: AdminCourse): AdminCourse {
  const slug = course.slug || slugify(course.metadata.title);
  const id = course.id || slug || `course-${Date.now().toString(36)}`;
  const modules = course.modules.map((module, moduleIndex) => ({
    ...module,
    id: module.id || slugify(module.title) || `module-${moduleIndex + 1}`,
    position: moduleIndex + 1,
    lessons: module.lessons.map((lesson, lessonIndex) => ({
      ...lesson,
      id: lesson.id || slugify(lesson.title) || `lesson-${lessonIndex + 1}`,
      position: lessonIndex + 1,
    })),
  }));
  const lessonCount = modules.reduce((total, module) => total + module.lessons.length, 0);
  return {
    ...course,
    id,
    slug,
    metadata: { ...course.metadata, lessonCount },
    welcome: { ...course.welcome, courseId: id, title: course.metadata.shortTitle || course.metadata.title },
    modules,
  };
}

export function createBlankCourse(): AdminCourse {
  return {
    schemaVersion: 1,
    id: "",
    slug: "",
    version: 1,
    status: "draft",
    visibility: "hidden",
    metadata: { title: "", shortTitle: "", category: "AI Automation", description: "", level: "Beginner", lessonCount: 1, language: "en", tags: [] },
    outcomes: [],
    requirements: [],
    source: { format: "markdown", path: "course-content.md", encoding: "utf-8" },
    assets: [],
    welcome: {
      schemaVersion: 1,
      courseId: "",
      title: "",
      overview: { heading: "", paragraphs: [] },
      howItWorks: { heading: "How It Works", steps: [] },
      finalOutcome: { heading: "Final Outcome", description: "" },
    },
    modules: [{
      id: "module-1",
      position: 1,
      title: "",
      description: "",
      lessons: [{
        id: "lesson-1",
        position: 1,
        title: "",
        content: "",
        objectives: [],
        activity: { type: "guided-lab", prompt: "", completionType: "learner-confirmation" },
        assessmentIds: [],
      }],
    }],
    assessments: [],
  };
}

export const courseAdminData = {
  async list(): Promise<AdminCourse[]> {
    return readCourses();
  },

  async get(courseId: string): Promise<AdminCourse> {
    const course = readCourses().find((item) => item.id === courseId);
    if (!course) throw new Error("Course not found.");
    return clone(course);
  },

  async stats(): Promise<CourseAdminStats> {
    const courses = readCourses();
    return {
      totalLearners: 1248,
      lessonCompletions: 3892,
      totalCourses: courses.length,
      publicCourses: courses.filter((course) => course.visibility === "public").length,
      privateCourses: courses.filter((course) => course.visibility === "private").length,
      hiddenCourses: courses.filter((course) => course.visibility === "hidden").length,
      totalLessons: courses.reduce((total, course) => total + course.modules.reduce((moduleTotal, module) => moduleTotal + module.lessons.length, 0), 0),
      draftCourses: courses.filter((course) => course.status === "draft").length,
    };
  },

  async create(course: AdminCourse): Promise<AdminCourse> {
    const normalized = normalizeCourse(course);
    const courses = readCourses();
    if (courses.some((item) => item.id === normalized.id)) normalized.id = `${normalized.id}-${Date.now().toString(36)}`;
    normalized.welcome.courseId = normalized.id;
    writeCourses([normalized, ...courses]);
    return clone(normalized);
  },

  async update(courseId: string, course: AdminCourse): Promise<AdminCourse> {
    const courses = readCourses();
    const index = courses.findIndex((item) => item.id === courseId);
    if (index < 0) throw new Error("Course not found.");
    const normalized = normalizeCourse({ ...course, id: courseId });
    courses[index] = normalized;
    writeCourses(courses);
    return clone(normalized);
  },

  async setVisibility(courseId: string, visibility: CourseVisibility): Promise<AdminCourse> {
    const course = await this.get(courseId);
    course.visibility = visibility;
    return this.update(courseId, course);
  },

  async remove(courseId: string): Promise<void> {
    writeCourses(readCourses().filter((course) => course.id !== courseId));
  },
};
