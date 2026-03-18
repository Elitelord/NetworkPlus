// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BulkEditModal } from "./bulk-edit-modal";

const contacts = [
  { id: "1", name: "Alice", email: "alice@example.com", groups: ["Group A"] },
  { id: "2", name: "Bob", email: "bob@example.com", groups: ["Group B"] },
  { id: "3", name: "Carol", email: "carol@example.com", groups: ["Group A"] },
];

const allGroups = ["Group A", "Group B"];

describe("BulkEditModal", () => {
  it("keeps selections when filtering by search", () => {
    const onSuccess = vi.fn();
    render(
      <BulkEditModal
        contacts={contacts as any}
        allGroups={allGroups}
        onSuccess={onSuccess}
      />
    );

    // open dialog via trigger
    fireEvent.click(screen.getByText("Bulk Edit Contacts"));

    // select Alice
    fireEvent.click(screen.getByText("Alice").closest("tr")!);
    expect(screen.getByText("1 selected")).toBeTruthy();

    // filter so Alice disappears
    const searchInput = screen.getByPlaceholderText("Search contacts...") as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: "Bob" } });

    // selection count should remain 1
    expect(screen.getByText("1 selected")).toBeTruthy();
  });

  it("enforces exact selection count in link-selection intent", () => {
    const onDone = vi.fn();
    const onSuccess = vi.fn();
    render(
      <BulkEditModal
        hideTrigger
        openOverride
        contacts={contacts as any}
        allGroups={allGroups}
        onSuccess={onSuccess}
        intent={{ kind: "link-selection", maxNodes: 2, onDone }}
      />
    );

    // select one contact -> action bar appears, confirm disabled
    fireEvent.click(screen.getByText("Alice").closest("tr")!);
    let confirm = screen.getByText("Confirm selection") as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);

    // select second -> enabled
    fireEvent.click(screen.getByText("Bob").closest("tr")!);
    confirm = screen.getByText("Confirm selection") as HTMLButtonElement;
    expect(confirm.disabled).toBe(false);

    fireEvent.click(confirm);
    expect(onDone).toHaveBeenCalledWith(["1", "2"]);
  });

  it("shows type filter pills when groups exist", () => {
    const onSuccess = vi.fn();
    render(
      <BulkEditModal
        contacts={contacts as any}
        allGroups={allGroups}
        onSuccess={onSuccess}
      />
    );

    fireEvent.click(screen.getByText("Bulk Edit Contacts"));
    // At least one type pill should be present (unrecognized groups default to "Employment")
    expect(
      screen.queryByText("Employment") ||
      screen.queryByText("School / Education") ||
      screen.queryByText("Other")
    ).toBeTruthy();
  });
});

