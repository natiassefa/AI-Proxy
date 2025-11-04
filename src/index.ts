// Load environment variables first, before any other imports
import dotenv from "dotenv";
dotenv.config();

import { startServer } from "./server.js";
import { loadConfig } from "./config.js";
loadConfig();
startServer();
