import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { APP_TITLE } from '@/constants/appBrand';

document.title = APP_TITLE;
const ogTitle = document.querySelector('meta[property="og:title"]');
if (ogTitle) {
  ogTitle.setAttribute('content', APP_TITLE);
}

createRoot(document.getElementById("root")!).render(<App />);
