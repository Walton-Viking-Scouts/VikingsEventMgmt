import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import LoadingScreen from "../LoadingScreen";

describe("LoadingScreen", () => {
  it("renders loading text", () => {
    render(<LoadingScreen data-oid=".kdlj4g" />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("displays custom message when provided", () => {
    const message = "Loading data...";
    render(<LoadingScreen message={message} data-oid="8mz5_h0" />);
    expect(screen.getByText(message)).toBeInTheDocument();
  });
});
