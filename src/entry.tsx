import { createRoot } from "react-dom/client";
import { Buffer } from "buffer";
import App from "./App";
import "./styles.css";
import "./complete.css";
Object.assign(globalThis, { Buffer });
createRoot(document.getElementById("root")!).render(<App />);
