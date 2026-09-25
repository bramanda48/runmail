import js from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginVue from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  // Ignore patterns
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.wrangler/**",
      "**/migrations/**",
      "**/*.min.js",
      "**/.output/**",
      "**/.vercel/**",
      "**/.netlify/**",
      "**/coverage/**",
      "**/.turbo/**"
    ]
  },

  // Base configs
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs["flat/recommended"],

  // TypeScript files
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module"
      },
      globals: {
        // Browser globals
        window: "readonly",
        document: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        console: "readonly",
        fetch: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        navigator: "readonly",
        Event: "readonly",
        HTMLElement: "readonly",
        HTMLInputElement: "readonly"
      }
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-useless-assignment": "warn"
    }
  },

  // Vue files
  {
    files: ["**/*.vue"],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        ecmaVersion: "latest",
        sourceType: "module"
      },
      globals: {
        // Browser globals
        window: "readonly",
        document: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        console: "readonly",
        fetch: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        navigator: "readonly",
        Event: "readonly",
        HTMLElement: "readonly",
        HTMLInputElement: "readonly",
        Blob: "readonly"
      }
    },
    rules: {
      // Disable rules that conflict with Biome's previous settings
      "vue/multi-word-component-names": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "vue/no-unused-vars": "off",

      // Vue-specific rules
      "vue/html-indent": ["error", 2],
      "vue/max-attributes-per-line": "off",
      "vue/singleline-html-element-content-newline": "off",
      "vue/html-self-closing": [
        "error",
        {
          html: {
            void: "always",
            normal: "always",
            component: "always"
          },
          svg: "always",
          math: "always"
        }
      ],
      // Relax some common Vue warnings
      "vue/attribute-hyphenation": "off",
      "vue/require-default-prop": "off",
      "vue/attributes-order": "warn",
      "vue/no-v-html": "warn"
    }
  },

  // JavaScript files
  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module"
    }
  },

  // Prettier config last to disable conflicting rules
  eslintConfigPrettier
);
