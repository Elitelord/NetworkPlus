"use client";

import { cn } from "@/lib/utils";
import { 
  User, 
  Lock, 
  Bell, 
  Tags, 
  BarChart3, 
  Network, 
  Users, 
  AlertTriangle,
  Briefcase
} from "lucide-react";
import { useEffect, useState } from "react";

const sections = [
  { id: "profile", label: "Profile", icon: User },
  { id: "usage-preferences", label: "Preferences", icon: Briefcase },
  { id: "security", label: "Security", icon: Lock },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "group-types", label: "Group Types", icon: Tags },
  { id: "frequency", label: "Frequency", icon: BarChart3 },
  { id: "graph", label: "Graph", icon: Network },
  { id: "shared-groups", label: "Shared Groups", icon: Users },
  { id: "danger", label: "Danger Zone", icon: AlertTriangle, danger: true },
];

export function SettingsSidebar() {
  const [activeSection, setActiveSection] = useState("profile");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { threshold: 0.5, rootMargin: "-100px 0px -50% 0px" }
    );

    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    // Find the scrollable <main> ancestor (overflow-auto container)
    const scrollableMain = el.closest("main");
    if (scrollableMain) {
      const offset = 24; // small buffer
      const top = el.offsetTop - offset;
      scrollableMain.scrollTo({ top, behavior: "smooth" });
    } else {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-4 md:pb-0 sticky top-24 h-fit max-h-[calc(100vh-8rem)]">
      {sections.map((section) => (
        <button
          key={section.id}
          onClick={() => scrollTo(section.id)}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm whitespace-nowrap",
            activeSection === section.id
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
            section.danger && activeSection === section.id && "bg-destructive/10 text-destructive",
            section.danger && activeSection !== section.id && "hover:bg-destructive/10 hover:text-destructive"
          )}
        >
          <section.icon className="h-4 w-4 shrink-0" />
          <span>{section.label}</span>
        </button>
      ))}
    </nav>
  );
}
