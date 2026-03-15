import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Minus, RotateCcw, Maximize, Minimize } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface GraphZoomControlsProps {
    currentZoom: number;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onResetZoom: () => void;
    onSetZoom: (zoom: number) => void;
    isFullscreen?: boolean;
    onToggleFullscreen?: () => void;
    className?: string;
}

export function GraphZoomControls({
    currentZoom,
    onZoomIn,
    onZoomOut,
    onResetZoom,
    onSetZoom,
    isFullscreen,
    onToggleFullscreen,
    className,
}: GraphZoomControlsProps) {
    const [isOpen, setIsOpen] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleMouseEnter = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setIsOpen(true);
    };

    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => {
            setIsOpen(false);
        }, 300); // Small delay to prevent flickering when moving cursor
    };

    const zoomLevels = [0.5, 1, 2, 4, 8, 16];

    // Find nearest zoom level for display
    const displayZoom = Math.round(currentZoom * 100);

    return (
        <div
            id="tour-zoom-controls"
            className={cn("absolute bottom-6 right-6 z-10 flex flex-col items-end gap-2", className)}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <div
                className={cn(
                    "bg-background/60 backdrop-blur-xl border shadow-lg rounded-xl overflow-hidden transition-all duration-300 origin-bottom-right flex flex-col items-center",
                    isOpen ? "opacity-100 scale-100 mb-2 translate-y-0" : "opacity-0 scale-95 translate-y-4 pointer-events-none absolute bottom-12"
                )}
            >
                <div className="flex flex-col p-1 w-12 gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="w-10 h-10 rounded-lg hover:bg-accent"
                        onClick={onZoomIn}
                        title="Zoom In"
                    >
                        <Plus className="w-5 h-5" />
                    </Button>

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="ghost"
                                className="w-10 h-8 text-[11px] font-medium p-0 hover:bg-accent focus-visible:ring-0"
                                title="Zoom Level"
                            >
                                {displayZoom}%
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent side="left" className="w-32 p-1 bg-background/60 backdrop-blur-xl border shadow-lg rounded-xl" align="center">
                            <div className="flex flex-col gap-0.5">
                                {zoomLevels.map((z) => (
                                    <Button
                                        key={z}
                                        variant={Math.abs(currentZoom - z) < 0.1 ? "secondary" : "ghost"}
                                        size="sm"
                                        className="justify-start text-xs h-7"
                                        onClick={() => onSetZoom(z)}
                                    >
                                        {Math.round(z * 100)}%
                                    </Button>
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="w-10 h-10 rounded-lg hover:bg-accent"
                        onClick={onZoomOut}
                        title="Zoom Out"
                    >
                        <Minus className="w-5 h-5" />
                    </Button>

                    <div className="w-8 h-px bg-border mx-auto my-0.5" />

                    <Button
                        variant="ghost"
                        size="icon"
                        className="w-10 h-10 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground"
                        onClick={onResetZoom}
                        title="Reset View"
                    >
                        <RotateCcw className="w-4 h-4" />
                    </Button>

                    {onToggleFullscreen && (
                        <>
                            <div className="w-8 h-px bg-border mx-auto my-0.5" />
                            <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                    "w-10 h-10 rounded-lg hover:bg-accent",
                                    isFullscreen ? "text-primary" : "text-muted-foreground hover:text-foreground"
                                )}
                                onClick={onToggleFullscreen}
                                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                            >
                                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                            </Button>
                        </>
                    )}
                </div>
            </div>

            <Button
                variant="outline"
                size="icon"
                className={cn(
                    "w-12 h-12 rounded-full shadow-lg bg-background/60 backdrop-blur-xl border hover:bg-accent/80 transition-all duration-300",
                    isOpen ? "rotate-90 bg-accent text-accent-foreground border-primary/50" : ""
                )}
                onClick={() => setIsOpen(!isOpen)}
            >
                <Maximize className="w-5 h-5" />
            </Button>
        </div>
    );
}
