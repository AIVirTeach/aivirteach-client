import type { Metadata } from "next";
import "./admin.css";

export const metadata: Metadata = {
  title: "Admin",
  description: "Manage AIVirTeach lessons and learning content.",
};

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
