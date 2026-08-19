export const mockCourseId = "python-basics-browser-lab";
export const mockCourseProgressStorageKey = "aivirteach.mockCourse.pythonBasics.v1";
export const mockCourseProgressEvent = "aivirteach:mock-course-progress";

export type MockCourseSkill = "Python syntax" | "Variables" | "Conditionals" | "Functions";

export type MockCourseLesson = {
  id: string;
  number: number;
  title: string;
  skill: MockCourseSkill;
  objective: string;
  explanation: string;
  code: string;
  prompt: string;
  choices: string[];
  answer: number;
  answerExplanation: string;
};

export type MockCourseProgress = {
  version: 1;
  startedAt: string | null;
  lastActiveAt: string | null;
  totalSeconds: number;
  attempts: number;
  correctAnswers: number;
  completedLessonIds: string[];
  dailySeconds: Record<string, number>;
};

export const mockCourseLessons: MockCourseLesson[] = [
  {
    id: "hello-python",
    number: 1,
    title: "Print your first message",
    skill: "Python syntax",
    objective: "Use print() to display text in Python.",
    explanation: "Python runs instructions from top to bottom. The print function displays the value placed inside its parentheses. Text values are surrounded by quotation marks.",
    code: 'print("Hello, learner!")',
    prompt: "Which line correctly prints the words Hello, Python!?",
    choices: ['print("Hello, Python!")', 'print["Hello, Python!"]', 'echo("Hello, Python!")'],
    answer: 0,
    answerExplanation: "Correct. Python uses print followed by parentheses, with the text inside quotation marks.",
  },
  {
    id: "use-variables",
    number: 2,
    title: "Store values in variables",
    skill: "Variables",
    objective: "Create a variable and reuse its value.",
    explanation: "A variable gives a name to a value. Python creates one with the equals sign. Once stored, that name can be passed to functions such as print.",
    code: 'course = "Python Basics"\nprint(course)',
    prompt: "Which statement stores the number 12 in a variable named score?",
    choices: ["score == 12", "12 = score", "score = 12"],
    answer: 2,
    answerExplanation: "Correct. Assignment places the variable name on the left and its value on the right of a single equals sign.",
  },
  {
    id: "make-decisions",
    number: 3,
    title: "Make a decision",
    skill: "Conditionals",
    objective: "Use an if statement to run code conditionally.",
    explanation: "An if statement checks whether a condition is true. Its line ends with a colon, and the instruction that belongs to it is indented on the following line.",
    code: 'score = 12\nif score >= 10:\n    print("Level complete")',
    prompt: "What will the example display when score is 12?",
    choices: ["Nothing", "Level complete", "12 >= 10"],
    answer: 1,
    answerExplanation: "Correct. Twelve is greater than ten, so the condition is true and the indented print instruction runs.",
  },
  {
    id: "reuse-functions",
    number: 4,
    title: "Reuse code with a function",
    skill: "Functions",
    objective: "Define and call a small reusable function.",
    explanation: "Functions group instructions under a name. Define one with def, then call it using its name followed by parentheses. Parameters let a function work with different values.",
    code: 'def greet(name):\n    print("Hello, " + name)\n\ngreet("Amina")',
    prompt: "Which line calls the greet function with the name Amina?",
    choices: ['greet("Amina")', 'def greet("Amina")', 'call greet = "Amina"'],
    answer: 0,
    answerExplanation: "Correct. A function call uses the function name and supplies its value inside parentheses.",
  },
];

export function emptyMockCourseProgress(): MockCourseProgress {
  return {
    version: 1,
    startedAt: null,
    lastActiveAt: null,
    totalSeconds: 0,
    attempts: 0,
    correctAnswers: 0,
    completedLessonIds: [],
    dailySeconds: {},
  };
}

export function readMockCourseProgress(): MockCourseProgress {
  if (typeof window === "undefined") return emptyMockCourseProgress();
  const stored = window.localStorage.getItem(mockCourseProgressStorageKey);
  if (!stored) return emptyMockCourseProgress();
  try {
    const parsed = JSON.parse(stored) as Partial<MockCourseProgress>;
    return {
      ...emptyMockCourseProgress(),
      ...parsed,
      completedLessonIds: Array.isArray(parsed.completedLessonIds) ? parsed.completedLessonIds : [],
      dailySeconds: parsed.dailySeconds && typeof parsed.dailySeconds === "object" ? parsed.dailySeconds : {},
    };
  } catch {
    return emptyMockCourseProgress();
  }
}

export function writeMockCourseProgress(progress: MockCourseProgress) {
  window.localStorage.setItem(mockCourseProgressStorageKey, JSON.stringify(progress));
  window.dispatchEvent(new CustomEvent(mockCourseProgressEvent, { detail: progress }));
  return progress;
}

export function startMockCourse() {
  const progress = readMockCourseProgress();
  const now = new Date().toISOString();
  return writeMockCourseProgress({ ...progress, startedAt: progress.startedAt ?? now, lastActiveAt: now });
}

export function addMockCourseTime(seconds: number) {
  if (seconds <= 0) return readMockCourseProgress();
  const progress = readMockCourseProgress();
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  return writeMockCourseProgress({
    ...progress,
    startedAt: progress.startedAt ?? now.toISOString(),
    lastActiveAt: now.toISOString(),
    totalSeconds: progress.totalSeconds + seconds,
    dailySeconds: { ...progress.dailySeconds, [day]: (progress.dailySeconds[day] ?? 0) + seconds },
  });
}

export function recordMockCourseAnswer(lessonId: string, correct: boolean) {
  const progress = readMockCourseProgress();
  const alreadyComplete = progress.completedLessonIds.includes(lessonId);
  return writeMockCourseProgress({
    ...progress,
    attempts: progress.attempts + 1,
    correctAnswers: progress.correctAnswers + (correct ? 1 : 0),
    completedLessonIds: correct && !alreadyComplete ? [...progress.completedLessonIds, lessonId] : progress.completedLessonIds,
    lastActiveAt: new Date().toISOString(),
  });
}

export function resetMockCourseProgress() {
  window.localStorage.removeItem(mockCourseProgressStorageKey);
  const progress = emptyMockCourseProgress();
  window.dispatchEvent(new CustomEvent(mockCourseProgressEvent, { detail: progress }));
  return progress;
}

export function mockCourseCompletion(progress: MockCourseProgress) {
  return Math.round(progress.completedLessonIds.length / mockCourseLessons.length * 100);
}

export function mockCourseSkillScores(progress: MockCourseProgress) {
  return mockCourseLessons.map((lesson) => ({
    name: lesson.skill,
    value: progress.completedLessonIds.includes(lesson.id) ? 100 : 0,
  }));
}

export function mockCourseWeeklyHours(progress: MockCourseProgress) {
  const today = new Date();
  const day = today.getDay() || 7;
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(today.getDate() - day + 1);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const seconds = progress.dailySeconds[date.toISOString().slice(0, 10)] ?? 0;
    return Math.round(seconds / 360) / 10;
  });
}

export function mockCourseStreak(progress: MockCourseProgress) {
  const activeDays = new Set(Object.entries(progress.dailySeconds).filter(([, seconds]) => seconds > 0).map(([day]) => day));
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  while (activeDays.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
