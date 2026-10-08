import { setupServer } from "msw/node";

/** Mock backend (through the BFF path). Tests add handlers with server.use(...). */
export const server = setupServer();

export const API = "http://localhost/api/backend/api/v1";
