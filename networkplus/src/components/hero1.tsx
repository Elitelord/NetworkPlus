import { ArrowRight, ArrowUpRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Hero1Props {
  badge?: string;
  heading: string;
  description: string;
  buttons?: {
    primary?: {
      text: string;
      url: string;
    };
    secondary?: {
      text: string;
      url: string;
    };
  };
  image?: {
    src: string;
    alt: string;
  };
}

const Hero1 = ({
  badge = "✨ Your Website Builder",
  heading = "Blocks Built With Shadcn & Tailwind",
  description = "Finely crafted components built with React, Tailwind and Shadcn UI. Developers can copy and paste these blocks directly into their project.",
  buttons = {
    primary: {
      text: "Discover all components",
      url: "https://www.shadcnblocks.com",
    },
    secondary: {
      text: "View on GitHub",
      url: "https://www.shadcnblocks.com",
    },
  },
  image,
}: Hero1Props) => {
  return (
    <section className="py-12 md:py-20">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col items-center text-center gap-8">
          <div className="max-w-3xl flex flex-col items-center">
            {badge && (
              <Badge variant="outline" className="mb-4">
                {badge}
              </Badge>
            )}
            <h1 className="my-3 text-4xl font-extrabold tracking-tight lg:text-6xl text-pretty">
              {heading}
            </h1>
            <p className="text-muted-foreground mb-6 max-w-2xl text-lg md:text-xl px-4">
              {description}
            </p>
            <div className="flex w-full flex-col justify-center gap-4 sm:flex-row">
              {buttons.primary && (
                <Button asChild size="lg" className="w-full sm:w-auto">
                  <a href={buttons.primary.url}>{buttons.primary.text}</a>
                </Button>
              )}
              {buttons.secondary && (
                <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                  <a href={buttons.secondary.url}>
                    {buttons.secondary.text}
                    {/* <ArrowRight className="ml-2 size-4" /> */}
                  </a>
                </Button>
              )}
            </div>
          </div>
          {image && (
            <div className="mt-4 w-full max-w-5xl">
              <img
                src={image.src}
                alt={image.alt}
                className="w-full rounded-xl border object-cover shadow-2xl"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export { Hero1 };
