"use client";

import * as React from "react";
import { Search, Sparkles, User, Loader2 } from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface Contact {
  id: string;
  name: string;
  groups: string[];
  metadata?: {
    inferredBio?: string;
  };
}

interface MagicSearchProps {
  onFocusNode: (id: string) => void;
  className?: string;
}

export function MagicSearch({ onFocusNode, className }: MagicSearchProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<Contact[]>([]);
  const [loading, setLoading] = React.useState(false);
  const performSearch = React.useCallback(async () => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    console.log("[Magic Search] Calling API with query:", query);
    setLoading(true);
    try {
      const res = await fetch(`/api/contacts/search?q=${encodeURIComponent(query)}`);
      console.log("[Magic Search] API Response status:", res.status);
      if (res.ok) {
        const data = await res.json();
        console.log("[Magic Search] Received results:", data.length);
        setResults(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("[Magic Search] Fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, [query]);

  return (
    <>
      <div
        className={cn(
          "pointer-events-auto flex items-center justify-center pt-4",
          className
        )}
      >
        <button
          onClick={() => setOpen(true)}
          className="group relative flex h-10 w-full max-w-[min(400px,calc(100vw-2rem))] items-center gap-2 rounded-full border border-border/40 bg-background/60 px-4 text-sm text-muted-foreground backdrop-blur-xl transition-all hover:bg-background/80 hover:shadow-lg hover:shadow-primary/5 active:scale-95"
        >
          <Search className="h-4 w-4 transition-colors group-hover:text-primary" />
          <span className="flex-1 text-left truncate">Ask anything or search...</span>
          <Sparkles className="absolute -right-1 -top-1 h-3.5 w-3.5 animate-pulse text-primary opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
      </div>

      <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
        <CommandInput
          placeholder="Ask AI about your network and press [Enter]..."
          value={query}
          onValueChange={setQuery}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              performSearch();
            }
          }}
        />
        <CommandList>
          {loading && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground border-b border-border/50">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>AI is thinking...</span>
            </div>
          )}

          {!loading && results.length === 0 && query.trim() !== "" && (
            <CommandEmpty>No results found for "{query}".</CommandEmpty>
          )}
          
          {results.length > 0 && (
            <CommandGroup heading="Search Results">
              {results.map((contact) => (
                <CommandItem
                  key={contact.id}
                  onSelect={() => {
                    onFocusNode(contact.id);
                    setOpen(false);
                  }}
                  className="cursor-pointer py-3"
                >
                  <User className="mr-2 h-4 w-4 text-primary/70" />
                  <div className="flex flex-col">
                    <span className="font-medium">{contact.name}</span>
                    {contact.metadata?.inferredBio && (
                      <span className="text-[11px] text-muted-foreground line-clamp-1">
                        {contact.metadata.inferredBio}
                      </span>
                    )}
                    {contact.groups && contact.groups.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {contact.groups.slice(0, 3).map(g => (
                          <span key={g} className="text-[9px] bg-muted px-1 rounded-sm">
                            {g}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
