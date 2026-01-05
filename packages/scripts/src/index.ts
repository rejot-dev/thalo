export const hello = () => {
  console.log("Hello from @kc/scripts!");
};

if (import.meta.main) {
  hello();
}
