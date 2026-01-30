import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./i18n";
import App from "./App.tsx";

import "@ibm/plex-math/css/ibm-plex-math-all.css";
import "@ibm/plex-mono/css/ibm-plex-mono-all.css";
import "@ibm/plex-sans/css/ibm-plex-sans-all.css";
import "@ibm/plex-sans-sc/css/ibm-plex-sans-sc-all.css";
import "@ibm/plex-serif/css/ibm-plex-serif-all.css";

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
