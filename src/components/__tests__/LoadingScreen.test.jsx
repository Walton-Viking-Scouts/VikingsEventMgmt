import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import LoadingScreen from "../LoadingScreen";

describe("LoadingScreen", () => {
  it("renders loading text", () => {
    render(<LoadingScreen data-oid="k0o69ku" />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("displays custom message when provided", () => {
    const message = "Loading data...";
    render(<LoadingScreen message={message} data-oid="8dmto0c" />);
    expect(screen.getByText(message)).toBeInTheDocument();
  });
});
