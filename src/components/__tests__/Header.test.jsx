import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Header from "../Header";

describe("Header", () => {
  it("renders with default props", () => {
    render(<Header data-oid="t5xlx5u" />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("displays hardcoded title", () => {
    render(<Header data-oid="8q79lw7" />);
    expect(screen.getByText("Vikings Event Mgmt")).toBeInTheDocument();
  });
});
