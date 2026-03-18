import { useMemo, useState } from "react";

type ContactLike = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  groups?: string[];
  strengthScore?: number;
};

interface UseContactSelectionWorkspaceOptions {
  contacts: ContactLike[];
  initialSelectedIds?: string[];
  initialGroupFilters?: string[];
}

export function useContactSelectionWorkspace({
  contacts,
  initialSelectedIds,
  initialGroupFilters,
}: UseContactSelectionWorkspaceOptions) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroupFilters, setSelectedGroupFilters] = useState<string[]>(initialGroupFilters ?? []);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(
    () => new Set(initialSelectedIds ?? [])
  );

  const filteredContacts = useMemo(() => {
    return contacts.filter((contact) => {
      const matchesSearch =
        contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (contact.email?.toLowerCase() || "").includes(searchQuery.toLowerCase());

      const contactGroups = contact.groups || [];
      const matchesGroups =
        selectedGroupFilters.length === 0 ||
        selectedGroupFilters.some((g) => contactGroups.includes(g));

      return matchesSearch && matchesGroups;
    });
  }, [contacts, searchQuery, selectedGroupFilters]);

  const selectedInFilteredCount = filteredContacts.reduce(
    (count, contact) => (selectedContactIds.has(contact.id) ? count + 1 : count),
    0
  );

  const isAllSelected =
    filteredContacts.length > 0 && selectedInFilteredCount === filteredContacts.length;

  const toggleSelectAllFiltered = () => {
    setSelectedContactIds((prev) => {
      const newSet = new Set(prev);
      if (isAllSelected) {
        filteredContacts.forEach((c) => newSet.delete(c.id));
      } else {
        filteredContacts.forEach((c) => newSet.add(c.id));
      }
      return newSet;
    });
  };

  const toggleContact = (id: string) => {
    setSelectedContactIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const resetSelectionState = () => {
    setSearchQuery("");
    setSelectedGroupFilters(initialGroupFilters ?? []);
    setSelectedContactIds(new Set(initialSelectedIds ?? []));
  };

  return {
    searchQuery,
    setSearchQuery,
    selectedGroupFilters,
    setSelectedGroupFilters,
    selectedContactIds,
    setSelectedContactIds,
    filteredContacts,
    isAllSelected,
    toggleSelectAllFiltered,
    toggleContact,
    resetSelectionState,
  };
}

