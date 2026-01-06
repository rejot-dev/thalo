/** @type {import('prettier').Config} */
const prettierConfig = {
  singleQuote: false,
  semi: true,
  tabWidth: 2,
  useTabs: false,
  printWidth: 100,
  proseWrap: "always",
  trailingComma: "all",
  plugins: ["@wilco/ptall-prettier"],
};

export default prettierConfig;
