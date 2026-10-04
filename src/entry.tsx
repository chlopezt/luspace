import { createRoot } from "react-dom/client";
import { Buffer } from "buffer";
import App from "./App";
import Landing from './Landing';
import "./styles.css";
import "./complete.css";
Object.assign(globalThis, { Buffer });
createRoot(document.getElementById("root")!).render(location.pathname === '/presentacion' ? <Landing/> : <App />);
