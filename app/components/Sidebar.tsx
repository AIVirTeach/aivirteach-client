import Link from "next/link";
import { Avatar } from "./Avatar";

type SidebarProps = { active: "dashboard" | "workspace" | "analysis" | "settings" };

const items = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: "▦" },
  { id: "workspace", label: "Learning Lab", href: "/workspace", icon: "‹›" },
  { id: "analysis", label: "Progress", href: "/analysis", icon: "⌁" },
  { id: "settings", label: "Settings", href: "#", icon: "⚙" },
] as const;

export function Sidebar({ active }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="profile-block">
        <Avatar size="large" />
        <div>
          <strong>Alex Chen</strong>
          <span>Pro Scholar</span>
          <em>Level 12</em>
        </div>
      </div>
      <nav className="side-nav" aria-label="Primary navigation">
        {items.map((item) => (
          <Link key={item.id} href={item.href} className={active === item.id ? "active" : ""}>
            <span className="nav-icon" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
