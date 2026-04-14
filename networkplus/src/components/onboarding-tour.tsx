"use client";
import { useEffect, useState, useCallback } from "react";
import Joyride, { CallBackProps, STATUS, Step, TooltipRenderProps } from "react-joyride";
import { useTheme } from "next-themes";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";

export function CustomTooltip({
    index,
    step,
    backProps,
    closeProps,
    primaryProps,
    skipProps,
    tooltipProps,
    isLastStep,
}: TooltipRenderProps) {
    return (
        <div
            {...tooltipProps}
            className="bg-background text-foreground border shadow-xl rounded-xl p-5 w-80 font-sans relative z-50"
        >
            <div className="flex justify-between items-start mb-3">
                {step.title && <h3 className="font-semibold text-base tracking-tight">{step.title}</h3>}
                <button {...closeProps} className="text-muted-foreground hover:text-foreground flex-shrink-0 ml-4">
                    <X className="w-4 h-4" />
                </button>
            </div>
            <div className="text-sm text-muted-foreground mb-5 leading-relaxed">
                {step.content}
            </div>
            <div className="flex items-center gap-2 w-full">
                {!isLastStep && (
                    <Button variant="ghost" size="sm" className="mr-auto text-xs" {...skipProps}>
                        Skip
                    </Button>
                )}
                {index > 0 && (
                    <Button variant="outline" size="sm" className={isLastStep ? "mr-auto" : ""} {...backProps}>
                        Back
                    </Button>
                )}
                <Button size="sm" {...primaryProps}>
                    {isLastStep ? "Quit" : "Next"}
                </Button>
            </div>
        </div>
    );
}

export function OnboardingTour() {
    const { theme, resolvedTheme } = useTheme();
    const [run, setRun] = useState(false);
    const [mounted, setMounted] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        setMounted(true);
        // Check if user has completed the tour
        fetch("/api/user/onboarding")
            .then(res => res.json())
            .then(data => {
                if (data && data.hasCompletedTour === false) {
                    setRun(true);
                }
            })
            .catch(err => console.error("Failed to check onboarding status:", err));
    }, []);

    const handleJoyrideCallback = useCallback(async (data: CallBackProps) => {
        const { status, lifecycle, step } = data;
        const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

        if (lifecycle === "tooltip") {
            // Because we have disableScrolling={true} to stop the whole React app from jumping,
            // we manually scroll only the scrollable sidebars if the target is inside them.
            if (typeof step.target === "string") {
                const targetElement = document.querySelector(step.target) as HTMLElement;
                if (targetElement) {
                    const scrollContainer = targetElement.closest('.overflow-y-auto');
                    if (scrollContainer) {
                        // Calculate relative position to scroll smoothly within the container
                        const offsetTop = targetElement.offsetTop;
                        scrollContainer.scrollTo({
                            top: offsetTop - 40, // 40px buffer from the top
                            behavior: "smooth"
                        });
                    }
                }
            }
        }

        if (finishedStatuses.includes(status)) {
            setRun(false);
            try {
                await fetch("/api/user/onboarding", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ hasCompletedTour: true })
                });
            } catch (err) {
                console.error("Failed to update onboarding status:", err);
            }
        }
    }, []);

    useEffect(() => {
        const handleStartTour = () => setRun(true);
        window.addEventListener('start-tour', handleStartTour);
        return () => window.removeEventListener('start-tour', handleStartTour);
    }, []);

    const steps: Step[] = [
        {
            target: "body",
            placement: "center",
            title: "Welcome to NetworkPlus! 👋",
            content: "Let's take a quick tour of your dashboard.",
            disableBeacon: true,
        },
        {
            target: "#tour-sidebar",
            title: "Reminders & Due Soon",
            content: "Here you'll see people you need to stay in touch with based on your interactions.",
            placement: "right",
        },
        {
            target: "#tour-add-contact",
            title: "Add Contacts Manually",
            content: "You can manually add contacts and categorize them into groups here.",
            placement: "left",
        },
        {
            target: "#tour-import-contacts",
            title: "Import Connections & Contacts",
            content: "Upload CSV files from Google Contacts or LinkedIn Connections. (LinkedIn: Settings > Data Privacy > Get a copy of your data > Connections).",
            placement: "left",
        },
        {
            target: "#tour-import-messages",
            title: "Import LinkedIn Messages",
            content: "Want to automatically log past interactions? Request your 'messages.csv' from LinkedIn and import it here to build your interaction history.",
            placement: "left",
        },
        {
            target: "#graph",
            title: "Your Network Graph",
            content: "Visualize your entire network! The dots represent contacts and the lines represent their connections.",
            placement: "center",
        },
        {
            target: "#tour-zoom-controls",
            title: "Zoom & Navigation",
            content: "Use these controls to zoom in and out of your graph, or enter fullscreen mode for a better view.",
            placement: "top-end",
        },
        {
            target: "#tour-legend",
            title: "Filters & Legend",
            content: "Filter your network by specific groups. This panel also explains the color-coding of your clusters.",
            placement: "top-start",
        },
        {
            target: "#tour-navbar-help",
            title: "Help & Replays",
            content: "You can click this question mark button at any time to replay this tour. Enjoy building your network!",
            placement: "bottom-end",
        }
    ];

    if (!mounted || pathname !== "/dashboard") return null;

    return (
        <Joyride
            steps={steps}
            run={run}
            continuous={true}
            showSkipButton={true}
            showProgress={true}
            disableScrolling={true}
            callback={handleJoyrideCallback}
            tooltipComponent={CustomTooltip}
            styles={{
                options: {
                    primaryColor: 'hsl(var(--primary))',
                    overlayColor: "rgba(0, 0, 0, 0.5)",
                    zIndex: 1000,
                }
            }}
            floaterProps={{
                disableAnimation: false,
                styles: {
                    floater: {
                        filter: "drop-shadow(0px 10px 15px rgba(0,0,0,0.1))"
                    }
                }
            }}
        />
    );
}
