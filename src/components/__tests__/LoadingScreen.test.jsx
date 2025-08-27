import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import LoadingScreen from "../LoadingScreen";

describe("LoadingScreen", () => {
  it("renders loading text", () => {
    render(<LoadingScreen data-oid="wa_x5t4" />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("displays custom message when provided", () => {
    const message = "Loading data...";
    render(<LoadingScreen message={message} data-oid="czc9pt2" />);
    expect(screen.getByText(message)).toBeInTheDocument();
  });
});
