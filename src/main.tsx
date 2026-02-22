import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

// rootEl -> Derived from `root` (DOM anchor) + `Element`
const rootEl = document.getElementById("root")!;
createRoot(rootEl).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
