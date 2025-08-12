import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import LoadingScreen from "../LoadingScreen";

describe("LoadingScreen", () => {
  it("renders loading text", () => {
    render(<LoadingScreen data-oid="ccklm8-" />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("displays custom message when provided", () => {
    const message = "Loading data...";
    render(<LoadingScreen message={message} data-oid="1lczzr8" />);
    expect(screen.getByText(message)).toBeInTheDocument();
  });
});
