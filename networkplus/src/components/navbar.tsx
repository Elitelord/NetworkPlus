"use client"

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Settings, HelpCircle } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Navbar() {
    const { data: session, status } = useSession();

    return (
        <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto flex h-14 max-w-screen-2xl items-center px-4 justify-between">
                <div className="flex items-center gap-6">
                    <Link href="/" className="mr-6 flex items-center space-x-2">
                        <span className="font-bold sm:inline-block">NetworkPlus</span>
                    </Link>
                    <div className="hidden md:flex gap-6">
                        <Link href="/" className="text-sm font-medium transition-colors hover:text-primary">
                            Home
                        </Link>
                        <Link href="/dashboard" className="text-sm font-medium transition-colors hover:text-primary">
                            Dashboard
                        </Link>
                        <Link href="/calendar" className="text-sm font-medium transition-colors hover:text-primary">
                            Calendar
                        </Link>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {status === "loading" ? (
                        <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
                    ) : session?.user ? (
                        <>
                            <span className="text-sm text-muted-foreground hidden sm:inline-block">
                                {session.user.name || session.user.email}
                            </span>
                            {session.user.image && (
                                <img
                                    src={session.user.image}
                                    alt="Avatar"
                                    className="h-7 w-7 rounded-full"
                                />
                            )}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => window.dispatchEvent(new Event('start-tour'))}
                                id="tour-navbar-help"
                                title="Replay Tour"
                            >
                                <HelpCircle className="h-4 w-4" />
                            </Button>
                            <Link href="/settings">
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <Settings className="h-4 w-4" />
                                </Button>
                            </Link>
                            <ThemeToggle />
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => signOut({ redirectTo: "/" })}
                            >
                                Sign Out
                            </Button>
                        </>
                    ) : (
                        <>
                            <ThemeToggle />
                            <Link href="/signin">
                                <Button variant="ghost" size="sm">Sign In</Button>
                            </Link>
                            <Link href="/signup">
                                <Button size="sm">Get Started</Button>
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </nav>
    );
}