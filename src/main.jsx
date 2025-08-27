import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { initSentry } from "./services/sentry.js";

// Initialize Sentry before rendering the app
initSentry();

createRoot(document.getElementById("root")).render(
  <StrictMode data-oid="4zqm0:g">
    <App data-oid="yixs78n" />
  </StrictMode>,
);
