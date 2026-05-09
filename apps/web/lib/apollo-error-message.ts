export function apolloErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "graphQLErrors" in err) {
    const gqlErrs = (err as { graphQLErrors?: { message: string }[] }).graphQLErrors;
    if (gqlErrs?.length) return gqlErrs.map((e) => e.message).join(" ");
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}
