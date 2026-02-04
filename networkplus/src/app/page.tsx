import Link from "next/link";
import { Hero1 } from "@/components/hero1";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Users, Upload, MessageSquare, Shield, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 font-sans dark:bg-black">
      <main className="flex-1">
        <header>
          {/* <Navbar /> */}
          <Hero1
            badge="Network Plus"
            heading="Welcome to Network Plus!"
            description="The professional relationship management tool designed for context, clarity, and scale."
            buttons={{
              primary: { text: "Get Started", url: "/signup" },
              secondary: { text: "Learn More", url: "#features" }
            }}
            image={{ src: "/images/network-plus.png", alt: "Network Plus hero image" }}
          />
        </header>

        {/* Features Section */}
        <section id="features" className="container mx-auto py-12 md:py-24 lg:py-32">
          <div className="mx-auto flex max-w-[58rem] flex-col items-center justify-center gap-4 text-center">
            <h2 className="font-heading text-3xl leading-[1.1] sm:text-3xl md:text-6xl text-center font-bold">
              What makes NetworkPlus different
            </h2>
            <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7 text-center mx-auto">
              Built for professionals who need more than just a contact list.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 mt-12">
            <Card>
              <CardHeader>
                <MessageSquare className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Contact-Centric Messaging</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Conversations are tied to rich contact profiles, not just phone numbers.
                </CardDescription>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Upload className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Bulk Contact Import</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Upload contacts via CSV and start messaging instantly — no manual setup.
                </CardDescription>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Users className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Structured, Not Noisy</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Designed for professional and semi-professional communication, not endless group chats.
                </CardDescription>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CheckCircle2 className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Built for Scale</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Whether it’s 20 contacts or 2,000, NetworkPlus stays organized.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* How it Works Section */}
        <section className="container mx-auto py-12 md:py-24 lg:py-32 bg-zinc-100 dark:bg-zinc-900 rounded-3xl my-8">
          <div className="mx-auto flex max-w-[58rem] flex-col items-center justify-center gap-4 text-center">
            <h2 className="font-heading text-3xl leading-[1.1] sm:text-3xl md:text-6xl font-bold">
              How it works
            </h2>
          </div>
          <div className="mx-auto grid justify-center gap-8 sm:grid-cols-2 md:max-w-[64rem] md:grid-cols-3 mt-12">
            <div className="relative flex flex-col gap-4 p-6 text-center items-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold">
                1
              </div>
              <h3 className="text-xl font-bold">Import your contacts</h3>
              <p className="text-muted-foreground">
                Upload a CSV or add contacts manually.
              </p>
            </div>
            <div className="relative flex flex-col gap-4 p-6 text-center items-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold">
                2
              </div>
              <h3 className="text-xl font-bold">Organize & review</h3>
              <p className="text-muted-foreground">
                Preview, validate, and manage your contact list.
              </p>
            </div>
            <div className="relative flex flex-col gap-4 p-6 text-center items-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold">
                3
              </div>
              <h3 className="text-xl font-bold">Start conversations</h3>
              <p className="text-muted-foreground">
                Message individuals or groups with full context.
              </p>
            </div>
          </div>
        </section>

        {/* Use Cases Section */}
        <section className="container mx-auto py-12 md:py-24 lg:py-32">
          <div className="mx-auto flex max-w-[58rem] flex-col items-center justify-center gap-4 text-center mb-12">
            <h2 className="font-heading text-3xl leading-[1.1] sm:text-3xl md:text-6xl font-bold">
              Who this is for
            </h2>
          </div>
          <div className="mx-auto grid justify-center gap-4 sm:grid-cols-2 md:max-w-[64rem]">
            <div className="rounded-lg border bg-background p-2">
              <div className="flex h-[180px] flex-col justify-between rounded-md p-6">
                <Users className="h-12 w-12 text-primary" />
                <div className="space-y-2">
                  <h3 className="font-bold">Students & organizations</h3>
                  <p className="text-sm text-muted-foreground">
                    Manage members and group communication efficiently.
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border bg-background p-2">
              <div className="flex h-[180px] flex-col justify-between rounded-md p-6">
                <MessageSquare className="h-12 w-12 text-primary" />
                <div className="space-y-2">
                  <h3 className="font-bold">Recruiters & founders</h3>
                  <p className="text-sm text-muted-foreground">
                    Keep conversations tied to real contacts, not just inboxes.
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border bg-background p-2">
              <div className="flex h-[180px] flex-col justify-between rounded-md p-6">
                <CheckCircle2 className="h-12 w-12 text-primary" />
                <div className="space-y-2">
                  <h3 className="font-bold">Small teams</h3>
                  <p className="text-sm text-muted-foreground">
                    Lightweight messaging without the overhead of heavy tools.
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border bg-background p-2">
              <div className="flex h-[180px] flex-col justify-between rounded-md p-6">
                <ArrowRight className="h-12 w-12 text-primary" />
                <div className="space-y-2">
                  <h3 className="font-bold">Power users</h3>
                  <p className="text-sm text-muted-foreground">
                    For people tired of mixing personal and professional chats.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trust & Privacy Section */}
        <section className="container mx-auto py-12 md:py-24 text-center">
          <div className="mx-auto max-w-2xl space-y-4">
            <div className="flex justify-center mb-4">
              <Shield className="h-16 w-16 text-muted-foreground/50" />
            </div>
            <h2 className="text-2xl font-bold">Trust & Privacy</h2>
            <p className="text-muted-foreground">
              NetworkPlus is built with privacy in mind. Your data is yours, and we prioritize security in every interaction.
            </p>
          </div>
        </section>

        <footer className="border-t bg-zinc-100 dark:bg-zinc-900">
          <div className="container mx-auto flex flex-col gap-4 py-8 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-muted-foreground text-center md:text-left">
              © {new Date().getFullYear()} NetworkPlus. All rights reserved.
            </p>
            <div className="flex gap-4 justify-center md:justify-end">
              <Link href="#" className="text-sm text-muted-foreground hover:text-primary">Twitter</Link>
              <Link href="#" className="text-sm text-muted-foreground hover:text-primary">LinkedIn</Link>
              <Link href="#" className="text-sm text-muted-foreground hover:text-primary">GitHub</Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
