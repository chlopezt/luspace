import { createRoot } from "react-dom/client";
import { Buffer } from "buffer";
import App from "./App";
import Landing from './Landing';
import {StartupProvider} from './StartupScreen';
import "./styles.css";
import "./complete.css";
Object.assign(globalThis, { Buffer });
createRoot(document.getElementById("root")!).render(<StartupProvider>{location.pathname === '/presentacion' ? <Landing/> : <App />}</StartupProvider>);
