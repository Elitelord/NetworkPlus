// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { AddLinkModal } from "./add-link-modal";

const nodes = [
  { id: "1", name: "Alice" },
  { id: "2", name: "Bob" },
];

describe("AddLinkModal", () => {
  it("renders two searchable contact choosers", async () => {
    const onSuccess = vi.fn();
    const links: any[] = [];

    render(<AddLinkModal nodes={nodes} links={links} onSuccess={onSuccess} />);

    // Open the dialog
    screen.getByText("Add Link").click();

    expect(await screen.findByText("Contact 1")).toBeTruthy();
    expect(await screen.findByText("Contact 2")).toBeTruthy();
  });
});

