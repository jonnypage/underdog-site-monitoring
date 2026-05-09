import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "src/graphql/schema.graphql",
  generates: {
    "src/graphql/generated.ts": {
      plugins: ["typescript", "typescript-resolvers"],
      config: {
        contextType: "../context.js#Context",
        useIndexSignature: true,
        scalars: {
          DateTime: "Date",
          JSON: "Record<string, unknown>"
        }
      }
    }
  }
};

export default config;
