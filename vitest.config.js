import { defineConfig, configDefaults } from "vitest/config";

// `npm test`: testes unitários (calc.js) e de telas (jsdom). Os testes das regras do
// Firestore precisam do emulador e rodam à parte em `npm run test:rules`.
export default defineConfig({
  test: { exclude: [...configDefaults.exclude, "tests/rules/**", "tests/e2e/**"] },
});
