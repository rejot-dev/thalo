import type { Workspace } from "../model/workspace.js";
import type { IFileSystem } from "./interface.js";

export interface WorkspaceFileChange {
  path: string;
  kind: "created" | "updated" | "deleted";
}

export async function applyWorkspaceFileChange(
  workspace: Workspace,
  fs: IFileSystem,
  change: WorkspaceFileChange,
): Promise<void> {
  const resolvedPath = fs.resolvePath("/", change.path);

  if (change.kind === "deleted") {
    workspace.removeDocument(resolvedPath);
    return;
  }

  const source = await fs.readFile(resolvedPath, "utf8");

  if (workspace.hasDocument(resolvedPath)) {
    workspace.updateDocument(resolvedPath, source);
    return;
  }

  workspace.addDocument(source, { filename: resolvedPath });
}
