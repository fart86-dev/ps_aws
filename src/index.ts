import "dotenv/config";
import { startServer } from "./server";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 9500;

startServer(PORT);
