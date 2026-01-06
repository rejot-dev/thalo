import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext): void {
  const formatter = vscode.languages.registerDocumentFormattingEditProvider("ptall", {
    async provideDocumentFormattingEdits(
      document: vscode.TextDocument,
    ): Promise<vscode.TextEdit[]> {
      const text = document.getText();

      try {
        // Dynamic import for ESM modules
        const prettier = await import("prettier");
        const ptallPrettier = await import("@wilco/ptall-prettier");

        const formatted = await prettier.format(text, {
          parser: "ptall",
          plugins: [ptallPrettier],
        });

        const fullRange = new vscode.Range(
          document.positionAt(0),
          document.positionAt(text.length),
        );

        return [vscode.TextEdit.replace(fullRange, formatted)];
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Ptall formatting failed: ${message}`);
        return [];
      }
    },
  });

  context.subscriptions.push(formatter);
}

export function deactivate(): void {
  // Nothing to clean up
}
