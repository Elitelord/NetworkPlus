"use client"

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Settings, HelpCircle, Menu, LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export default function Navbar() {
    const { data: session, status } = useSession();
    const pathname = usePathname();
    const isDashboard = pathname === "/dashboard";
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const navLinks = [
        { href: "/", label: "Home" },
        { href: "/dashboard", label: "Dashboard" },
        { href: "/calendar", label: "Calendar" },
    ];

    return (
        <nav
            className={cn(
                "sticky top-0 z-50 w-full border-b shrink-0 transition-colors",
                isDashboard
                    ? "border-border/30 bg-background/70 backdrop-blur-xl"
                    : "border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
            )}
        >
            <div className="container mx-auto flex h-14 max-w-screen-2xl items-center px-4 sm:px-6 justify-between gap-2 min-w-0">
                <div className="flex items-center gap-3 md:gap-6 min-w-0">
                    <Link href="/" className="flex items-center space-x-2 shrink-0">
                        <img src="/logo.svg" alt="NetworkPlus" className="h-7 w-7 rounded-md" />
                        <span className="font-bold hidden sm:inline">NetworkPlus</span>
                    </Link>
                    {/* Mobile nav menu — next to logo so left side is [Logo][Menu], right side is actions */}
                    <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                        <SheetTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0 md:hidden"
                                aria-label="Open menu"
                            >
                                <Menu className="h-5 w-5" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="w-[240px] flex flex-col gap-4 pt-8">
                            {navLinks.map(({ href, label }) => (
                                <Link
                                    key={href}
                                    href={href}
                                    className="text-sm font-medium transition-colors hover:text-primary py-2"
                                    onClick={() => setMobileMenuOpen(false)}
                                >
                                    {label}
                                </Link>
                            ))}
                        </SheetContent>
                    </Sheet>
                    <div className="hidden md:flex gap-6">
                        {navLinks.map(({ href, label }) => (
                            <Link key={href} href={href} className="text-sm font-medium transition-colors hover:text-primary whitespace-nowrap">
                                {label}
                            </Link>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-1 sm:gap-2 shrink-0 min-w-0">
                    {status === "loading" ? (
                        <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
                    ) : session?.user ? (
                        <>
                            <span className="text-sm text-muted-foreground hidden lg:inline-block truncate max-w-[120px]">
                                {session.user.name || session.user.email}
                            </span>
                            {session.user.image && (
                                <img
                                    src={session.user.image}
                                    alt="Avatar"
                                    className="h-7 w-7 rounded-full shrink-0 hidden sm:block"
                                />
                            )}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                onClick={() => window.dispatchEvent(new Event('start-tour'))}
                                id="tour-navbar-help"
                                title="Replay Tour"
                            >
                                <HelpCircle className="h-4 w-4" />
                            </Button>
                            <Link href="/settings">
                                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Settings">
                                    <Settings className="h-4 w-4" />
                                </Button>
                            </Link>
                            <ThemeToggle />
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0 md:hidden"
                                onClick={() => signOut({ redirectTo: "/" })}
                                aria-label="Sign out"
                            >
                                <LogOut className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="hidden md:inline-flex"
                                onClick={() => signOut({ redirectTo: "/" })}
                            >
                                Sign Out
                            </Button>
                        </>
                    ) : (
                        <>
                            <ThemeToggle />
                            <Link href="/signin">
                                <Button variant="ghost" size="sm" className="shrink-0">Sign In</Button>
                            </Link>
                            <Link href="/signup">
                                <Button size="sm" className="shrink-0">Get Started</Button>
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </nav>
    );
}