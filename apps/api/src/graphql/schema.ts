import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GraphQLScalarType, Kind, type ValueNode } from "graphql";
import { makeExecutableSchema } from "@graphql-tools/schema";
import type { Resolvers } from "./generated.js";
import { adminMutations, adminQueries } from "./resolvers/admin.js";
import { alertMutations, alertQueries } from "./resolvers/alerts.js";
import { deviceMutations, deviceQueries } from "./resolvers/devices.js";
import { measurementQueries } from "./resolvers/measurements.js";
import { siteQueries } from "./resolvers/sites.js";
import { userMutations, userQueries } from "./resolvers/user.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
const typeDefs = readFileSync(join(currentDir, "schema.graphql"), "utf8");

const DateTime = new GraphQLScalarType({
  name: "DateTime",
  serialize(value) {
    return value instanceof Date ? value.toISOString() : value;
  },
  parseValue(value) {
    return new Date(String(value));
  },
  parseLiteral(ast) {
    return ast.kind === Kind.STRING ? new Date(ast.value) : null;
  }
});

function parseJsonLiteral(ast: ValueNode): unknown {
  switch (ast.kind) {
    case Kind.STRING:
    case Kind.BOOLEAN:
      return ast.value;
    case Kind.INT:
    case Kind.FLOAT:
      return Number(ast.value);
    case Kind.NULL:
      return null;
    case Kind.LIST:
      return ast.values.map(parseJsonLiteral);
    case Kind.OBJECT: {
      const out: Record<string, unknown> = {};
      for (const f of ast.fields) {
        out[f.name.value] = parseJsonLiteral(f.value);
      }
      return out;
    }
    default:
      return null;
  }
}

const Json = new GraphQLScalarType({
  name: "JSON",
  serialize(value) {
    return value as unknown;
  },
  parseValue(value) {
    return value;
  },
  parseLiteral(ast) {
    return parseJsonLiteral(ast);
  }
});

const resolvers = {
  DateTime,
  JSON: Json,
  Query: {
    ...siteQueries,
    ...measurementQueries,
    ...alertQueries,
    ...userQueries,
    ...adminQueries,
    ...deviceQueries
  },
  Mutation: {
    ...userMutations,
    ...adminMutations,
    ...deviceMutations,
    ...alertMutations
  }
} as unknown as Resolvers;

export const schema = makeExecutableSchema({ typeDefs, resolvers });
