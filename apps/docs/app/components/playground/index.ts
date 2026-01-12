/**
 * Playground components barrel export.
 */

export {
  PlaygroundProvider,
  usePlayground,
  getPanelMeta,
  type PanelType,
} from "./playground-context";
export { PlaygroundPanel, PanelHeader } from "./playground-panel";
export { PlaygroundTabs, useResponsivePanelCount } from "./playground-tabs";
export { ThaloEditor } from "./thalo-editor";
export { AnimatedTerminal } from "./animated-terminal";
export {
  thaloExtension,
  thaloHighlightStyles,
  thaloEditorTheme,
} from "./thalo-codemirror-extension";
