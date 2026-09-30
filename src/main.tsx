import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./routes/router";
import "./index.css";
import "./studio.css";
import "./interaction.css";
import "./c-workspace.css";
import "./components/generation-workspace/regular-generation.css";
import "./components/generation-workspace/c-result-gallery.css";
import "./pages/workflow-home.css";
import "./features/reverse-projects/reverse-projects.css";

createRoot(document.getElementById("root")!).render(<StrictMode><RouterProvider router={router} /></StrictMode>);
