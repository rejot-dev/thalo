import type { Route } from "./+types/docs-index";
import { redirect } from "react-router";

export async function loader(_: Route.LoaderArgs) {
  // Redirect /docs to /docs/getting-started (first doc page)
  return redirect("/docs/getting-started", 301);
}
