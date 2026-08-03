export type SkillScore = { name: string; value: number };
export type DemoAchievement = { title: string; subtitle: string; icon: string; unlocked: boolean };
export type DemoActivity = { id: string; title: string; detail: string; occurredAt: string; kind: "lesson" | "practice" | "achievement" };
export type DemoAccountType = "beginner" | "advanced" | "all-clear";

export type DemoLearner = {
  id: string;
  accountType: DemoAccountType;
  name: string;
  email: string;
  role: string;
  plan: "Free" | "Premium";
  level: number;
  timezone: string;
  joinedAt: string;
  avatar: string;
  stats: {
    streakDays: number;
    practiceMinutes: number;
    last30PracticeMinutes: number;
    tasksCompleted: number;
    last30TasksCompleted: number;
    skillsMastered: number;
    weeklyGoalPercent: number;
  };
  course: {
    category: string;
    title: string;
    module: string;
    progress: number;
  };
  weeklyHours: number[];
  skills: SkillScore[];
  achievements: DemoAchievement[];
  recentActivity: DemoActivity[];
  notifications: string[];
  analytics: {
    practiceTrend: number;
    taskTrend: number;
    goalTrend: number;
    insight: string;
    insightDetail: string;
  };
};

export const beginnerLearner: DemoLearner = {
  id: "learner_beginner",
  accountType: "beginner",
  name: "Maya Tan",
  email: "maya.beginner@example.edu",
  role: "AI Foundations Learner",
  plan: "Free",
  level: 2,
  timezone: "Asia/Kuala_Lumpur",
  joinedAt: "2026-07-21",
  avatar: "/workspace-user.jpg",
  stats: {
    streakDays: 3,
    practiceMinutes: 345,
    last30PracticeMinutes: 345,
    tasksCompleted: 9,
    last30TasksCompleted: 9,
    skillsMastered: 1,
    weeklyGoalPercent: 58,
  },
  course: {
    category: "Generative AI",
    title: "Prompt Engineering Fundamentals",
    module: "Module 1: Prompt structure and intent",
    progress: 18,
  },
  weeklyHours: [0.4, 0.8, 0, 1.1, 0.5, 1.4, 0.7],
  skills: [
    { name: "Conceptual", value: 34 },
    { name: "Practical", value: 22 },
    { name: "Problem Solving", value: 29 },
  ],
  achievements: [
    { title: "First Workflow", subtitle: "Getting Started", icon: "✓", unlocked: true },
    { title: "3-Day Streak", subtitle: "Consistency", icon: "★", unlocked: true },
    { title: "Automation Explorer", subtitle: "Locked", icon: "◇", unlocked: false },
    { title: "API Whisperer", subtitle: "Locked", icon: "⌁", unlocked: false },
  ],
  recentActivity: [
    { id: "beginner_1", title: "What is an AI agent?", detail: "Completed the introductory lesson", occurredAt: "Today, 10:15", kind: "lesson" },
    { id: "beginner_2", title: "Workflow vocabulary", detail: "Practised for 22 minutes", occurredAt: "Yesterday, 19:40", kind: "practice" },
    { id: "beginner_3", title: "First workflow completed", detail: "Connected a trigger to an action", occurredAt: "Monday, 17:05", kind: "achievement" },
  ],
  notifications: [
    "Welcome, Maya! Your first learning path is ready.",
    "Try a 20-minute practice session to keep your streak going.",
  ],
  analytics: {
    practiceTrend: 18,
    taskTrend: 13,
    goalTrend: 8,
    insight: "You learn most consistently in short evening sessions. Another 25 minutes will complete this week's goal.",
    insightDetail: "Your strongest sessions were Tuesday and Saturday, with the best task completion rate in sessions under 30 minutes.",
  },
};

export const advancedLearner: DemoLearner = {
  id: "learner_advanced",
  accountType: "advanced",
  name: "Alex Chen",
  email: "alex.chen@example.edu",
  role: "AI Automation Learner",
  plan: "Premium",
  level: 12,
  timezone: "Asia/Kuala_Lumpur",
  joinedAt: "2026-05-18",
  avatar: "/dashboard-profile.jpg",
  stats: {
    streakDays: 21,
    practiceMinutes: 7860,
    last30PracticeMinutes: 2310,
    tasksCompleted: 187,
    last30TasksCompleted: 44,
    skillsMastered: 8,
    weeklyGoalPercent: 86,
  },
  course: {
    category: "n8n",
    title: "Build an Agent using n8n",
    module: "Module 4: Deployment and monitoring",
    progress: 68,
  },
  weeklyHours: [1.6, 2.3, 1.8, 2.7, 2.1, 3.2, 2.4],
  skills: [
    { name: "Conceptual", value: 84 },
    { name: "Practical", value: 76 },
    { name: "Problem Solving", value: 89 },
  ],
  achievements: [
    { title: "21-Day Streak", subtitle: "Consistency", icon: "★", unlocked: true },
    { title: "Workflow Architect", subtitle: "Automation", icon: "✓", unlocked: true },
    { title: "Debugging Pro", subtitle: "Problem Solving", icon: "◇", unlocked: true },
    { title: "API Whisperer", subtitle: "Locked", icon: "⌁", unlocked: false },
  ],
  recentActivity: [
    { id: "advanced_1", title: "Deployment checklist", detail: "Completed lesson 3 of Module 4", occurredAt: "Today, 09:42", kind: "lesson" },
    { id: "advanced_2", title: "Webhook debugging", detail: "Practised for 38 minutes", occurredAt: "Yesterday, 18:10", kind: "practice" },
    { id: "advanced_3", title: "Twenty-one-day streak", detail: "New personal best", occurredAt: "Yesterday, 18:08", kind: "achievement" },
  ],
  notifications: [
    "Your tutor left feedback on Deployment checklist.",
    "Your weekly goal is 86% complete.",
    "New lesson available: Monitoring your AI agent.",
  ],
  analytics: {
    practiceTrend: 9,
    taskTrend: 11,
    goalTrend: 6,
    insight: "Your debugging sessions are becoming more efficient, and you are on track to finish this module by Friday.",
    insightDetail: "Deployment exercises now take 12 minutes less on average than they did at the start of the month.",
  },
};

export const allClearLearner: DemoLearner = {
  id: "learner_all_clear",
  accountType: "all-clear",
  name: "Jordan Lee",
  email: "jordan.complete@example.edu",
  role: "AI Solutions Builder",
  plan: "Premium",
  level: 20,
  timezone: "Asia/Kuala_Lumpur",
  joinedAt: "2025-11-03",
  avatar: "/analysis-profile.jpg",
  stats: {
    streakDays: 45,
    practiceMinutes: 19260,
    last30PracticeMinutes: 1290,
    tasksCompleted: 436,
    last30TasksCompleted: 18,
    skillsMastered: 18,
    weeklyGoalPercent: 100,
  },
  course: {
    category: "AI Capstone",
    title: "Production AI Agent Capstone",
    module: "All modules and assessments complete",
    progress: 100,
  },
  weeklyHours: [1.1, 1.5, 0.8, 1.2, 0.6, 1.8, 1.0],
  skills: [
    { name: "Conceptual", value: 100 },
    { name: "Practical", value: 100 },
    { name: "Problem Solving", value: 100 },
  ],
  achievements: [
    { title: "45-Day Streak", subtitle: "Consistency", icon: "★", unlocked: true },
    { title: "Capstone Complete", subtitle: "Certification", icon: "✓", unlocked: true },
    { title: "Automation Expert", subtitle: "Mastery", icon: "◇", unlocked: true },
    { title: "API Whisperer", subtitle: "Integration", icon: "⌁", unlocked: true },
  ],
  recentActivity: [
    { id: "complete_1", title: "Capstone assessment", detail: "Passed with all requirements met", occurredAt: "Today, 11:20", kind: "achievement" },
    { id: "complete_2", title: "Production monitoring", detail: "Completed final course lesson", occurredAt: "Yesterday, 16:45", kind: "lesson" },
    { id: "complete_3", title: "Portfolio review", detail: "Practised for 35 minutes", occurredAt: "Monday, 14:10", kind: "practice" },
  ],
  notifications: [
    "All clear! You have completed every available learning module.",
    "Your capstone certificate is ready to view.",
  ],
  analytics: {
    practiceTrend: 4,
    taskTrend: 0,
    goalTrend: 0,
    insight: "All available learning goals are complete. Your current study pattern is ideal for maintaining mastery.",
    insightDetail: "This week you revisited integrations, monitoring, and deployment without any overdue learning goals.",
  },
};

export const mockLearners = [beginnerLearner, advancedLearner, allClearLearner] as const;
export const demoLearner = advancedLearner;

export function getMockLearner(id: string) {
  return mockLearners.find((learner) => learner.id === id) ?? demoLearner;
}

export function cloneMockLearner(learner: DemoLearner): DemoLearner {
  return JSON.parse(JSON.stringify(learner)) as DemoLearner;
}
