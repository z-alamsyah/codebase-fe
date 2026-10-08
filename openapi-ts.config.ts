import { defineConfig } from "@hey-api/openapi-ts";

// Source of the backend contract. Default: the spec committed in a sibling
// checkout of codebase-go. Override with OPENAPI_INPUT, e.g.
// OPENAPI_INPUT=http://localhost:8080/swagger/doc.json pnpm gen:api
const input = process.env.OPENAPI_INPUT ?? "../codebase-go/gen/openapi/swagger.json";

export default defineConfig({
  input,
  output: {
    path: "src/lib/api/generated",
    postProcess: ["prettier"],
  },
  plugins: [
    {
      name: "@hey-api/client-next",
      // Default config for the browser client (base URL = the BFF).
      runtimeConfigPath: "./src/lib/api/client-config",
    },
    "@hey-api/typescript",
    "@hey-api/sdk",
    {
      name: "@tanstack/react-query",
      queryOptions: true,
      mutationOptions: true,
    },
  ],
});
