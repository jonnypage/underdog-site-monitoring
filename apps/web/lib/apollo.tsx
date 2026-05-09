"use client";

import * as React from "react";
import { ApolloClient, ApolloProvider, HttpLink, InMemoryCache } from "@apollo/client";

const client = new ApolloClient({
  link: new HttpLink({
    uri: `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/graphql`,
    credentials: "include"
  }),
  cache: new InMemoryCache()
});

export function ApolloClientProvider({ children }: { children: React.ReactNode }) {
  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}
