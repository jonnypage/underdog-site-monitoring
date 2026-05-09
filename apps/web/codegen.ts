import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "../api/src/graphql/schema.graphql",
  documents: "lib/gql/operations/*.graphql",
  generates: {
    "lib/gql/generated/": {
      preset: "client",
      config: {
        scalars: {
          DateTime: "string",
          JSON: "Record<string, unknown>"
        }
      }
    }
  }
};

export default config;
