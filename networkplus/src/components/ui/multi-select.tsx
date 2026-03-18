
"use client";

import * as React from "react";
import { X, Check, ChevronsUpDown, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
    Command,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandEmpty,
    CommandSeparator,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type Option = string;

interface MultiSelectProps {
    options: Option[];
    selected: Option[];
    onChange: (selected: Option[]) => void;
    placeholder?: string;
    className?: string;
    creatable?: boolean;
    renderOption?: (option: Option) => React.ReactNode;
    renderSelectedItem?: (option: Option) => React.ReactNode;
    /** Control how selected chips are laid out inside the trigger. Default is wrapping rows. */
    selectedLayout?: "wrap" | "scroll-x";
}

export function MultiSelect({
    options,
    selected,
    onChange,
    placeholder = "Select...",
    className,
    creatable = true,
    renderOption,
    renderSelectedItem,
    selectedLayout = "wrap",
}: MultiSelectProps) {
    const [open, setOpen] = React.useState(false);
    const [inputValue, setInputValue] = React.useState("");

    const handleUnselect = (option: Option) => {
        onChange(selected.filter((s) => s !== option));
    };

    const handleSelect = (option: Option) => {
        if (selected.includes(option)) {
            handleUnselect(option);
        } else {
            onChange([...selected, option]);
        }
    };

    const availableOptions = options.filter((option) => !selected.includes(option));

    // Filter options based on input if Command doesn't do it automatically or for custom "Create" logic
    const filteredOptions = availableOptions.filter(opt => opt.toLowerCase().includes(inputValue.toLowerCase()));

    const selectedContainerClass =
        selectedLayout === "scroll-x"
            ? "flex-nowrap overflow-x-auto max-w-full"
            : "flex-wrap";

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full justify-between h-auto min-h-10", className)}
                >
                    <div className={cn("flex gap-1 items-center", selectedContainerClass)}>
                        {selected.length === 0 && (
                            <span className="text-muted-foreground font-normal">{placeholder}</span>
                        )}
                        {selected.map((option) => (
                            <Badge
                                key={option}
                                variant="secondary"
                                className="mr-1 mb-1 hover:bg-secondary/80"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleUnselect(option);
                                }}
                            >
                                {renderSelectedItem ? renderSelectedItem(option) : option}
                                <div
                                    className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer"
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            handleUnselect(option);
                                        }
                                    }}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                    }}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleUnselect(option);
                                    }}
                                >
                                    <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                </div>
                            </Badge>
                        ))}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
                <Command>
                    <CommandInput
                        placeholder="Search or create group..."
                        value={inputValue}
                        onValueChange={setInputValue}
                    />
                    <CommandList>
                        <CommandEmpty>
                            {creatable && inputValue.trim() !== "" ? (
                                <div
                                    className="py-2 px-4 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
                                    onClick={() => {
                                        handleSelect(inputValue.trim());
                                        setInputValue("");
                                        // Maybe keep open? Or close.
                                        // setOpen(false); 
                                    }}
                                >
                                    <Plus className="size-4" />
                                    Create "{inputValue}"
                                </div>
                            ) : (
                                "No groups found."
                            )}
                        </CommandEmpty>
                        <CommandGroup className="max-h-64 overflow-auto">
                            {availableOptions.map((option) => (
                                <CommandItem
                                    key={option}
                                    value={option}
                                    onSelect={() => {
                                        handleSelect(option);
                                        setInputValue("");
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            selected.includes(option) ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {renderOption ? renderOption(option) : option}
                                </CommandItem>
                            ))}
                            {creatable && inputValue.trim() !== "" && !availableOptions.some(o => o.toLowerCase() === inputValue.trim().toLowerCase()) && !selected.some(s => s.toLowerCase() === inputValue.trim().toLowerCase()) && (
                                <>
                                    <CommandSeparator />
                                    <CommandItem
                                        value={inputValue}
                                        onSelect={() => {
                                            handleSelect(inputValue.trim());
                                            setInputValue("");
                                        }}
                                        className="cursor-pointer"
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Create "{inputValue}"
                                    </CommandItem>
                                </>
                            )}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
