import { defineConfig } from "eslint/config";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import globals from "globals";
import js from "@eslint/js";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url); // eslint-disable-line no-underscore-dangle
const __dirname = path.dirname(__filename); // eslint-disable-line no-underscore-dangle
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default defineConfig([{
    extends: compat.extends("eslint:recommended"), // eslint-disable-line dot-notation

    languageOptions: {
        globals: {
            ...globals.node,
        },

        ecmaVersion: "latest",
        sourceType: "module",
    },

    rules: {
				// Possible Problems
        "array-callback-return": "warn", // uncertain if desired
        "constructor-super": "error",
        "for-direction": "error",
        "getter-return": "error",
        "no-async-promise-executor": "error",
        "no-await-in-loop": "warn", //warn until code has been refactored and tested
        "no-class-assign": "error",
        "no-compare-neg-zero": "error",
        "no-cond-assign": "warn", // have enjoyed this in the past but it doesn't lend to readability...
        "no-const-assign": "error",
        "no-constant-binary-expression": "error",
        "no-constant-condition": "warn", // still not sure about while (true)
        "no-constructor-return": "error",
        "no-control-regex": "warn", // uh...
        "no-debugger": "error",
        "no-dupe-args": "error",
        "no-dupe-class-members": "error",
        "no-dupe-else-if": "error",
        "no-dupe-keys": "error",
        "no-duplicate-case": "error",
        "no-duplicate-imports": "error",
        "no-empty-character-class": "error",
        "no-empty-pattern": "error",
        "no-ex-assign": "warn", // this could be useful... we'll see
        "no-fallthrough": "off", // I like this feature okay
        "no-func-assign": "error",
        "no-import-assign": "error",
        "no-inner-declarations": "error",
        "no-invalid-regexp": "error",
        "no-irregular-whitespace": "error",
        "no-loss-of-precision": "error",
        "no-misleading-character-class": "error",
        "no-new-native-nonconstructor": "error",
        "no-obj-calls": "error",
        "no-promise-executor-return": "error",
        "no-prototype-builtins": "error",
        "no-self-assign": "error",
        "no-self-compare": "error",
        "no-setter-return": "error",
        "no-sparse-arrays": "error",
        "no-template-curly-in-string": "error",
        "no-this-before-super": "error",
        "no-undef": "error",
        "no-unexpected-multiline": "warn", // I want to see this one first...
        "no-unmodified-loop-condition": "error",
        "no-unreachable": "error",
        "no-unreachable-loop": "error",
        "no-unsafe-finally": "error",
        "no-unsafe-negation": "error",
        "no-unsafe-optional-chaining": "error",
        "no-unused-private-class-members": "error",
        "no-unused-vars": "error",
        "no-use-before-define": "error",
        "no-useless-assignment": "error",
        "no-useless-backreference": "error",
        "require-atomic-updates": "error",
        "use-isnan": "error",
        "valid-typeof": "error",

				// Suggestions
        "accessor-pairs": "warn", // not sure...
        "arrow-body-style": ["error", "as-needed"],
        "block-scoped-var": "error",
        camelcase: ["error", { ignoreImports: true, ignoreDestructuring: true, properties: "never" }], // this should be fun
        "capitalized-comments": "off",
        "class-methods-use-this": "error",

        complexity: ["warn", { // let's just see...
            variant: "modified",
        }],

        "consistent-return": "error",
        "consistent-this": "error",
        curly: ["error", "multi-or-nest"],
        default: "off",
        "default-case-last": "error",
        "default-param-last": "error",

        "dot-notation": ["error", {
            //allowKeywords: false,
        }],

        eqeqeq: ["error", "smart"],
        "func-name-matching": "warn", // not sure if this would ever come up
        "func-names": ["error", "as-needed"],
        "func-style": ["error", "declaration"],
        "grouped-accessor-pairs": "off", // I'm more of an alphabetical method man myself (sometimes)
        "guard-for-in": "warn", // I don't get what they're talking about
        //"id-denylist": [],
        "id-length": ["error", { "min": 3, "exceptions": ["fs", "js", "id"] }],
        "init-declarations": "off",
        "logical-assignment-operators": ["error", "always"],
        "max-classes-per-file": "off",
        "max-depth": "off",
        "max-lines": "off",
        "max-lines-per-function": "off",
        "max-nested-callbacks": "off",
        "max-params": "off",
        "max-statements": "off",
        "new-cap": "error",
        "no-alert": "error",
        "no-array-constructor": "error",
        "no-bitwise": "off", // Discord.js uses these I think
        "no-caller": "error",
        "no-case-declarations": "warn", // pretty sure I use these a lot and would need a TON of refactoring
        "no-console": "off", // this is Node.js!
        "no-continue": "off",
        "no-delete-var": "error",
        "no-div-regex": "error",

        "no-else-return": ["error", {
            allowElseIf: true,
        }],

        "no-empty": "error",
        "no-empty-function": "error",
        "no-empty-static-block": "error",
        "no-eq-null": "error",
        "no-eval": "error",
        "no-extend-native": "error",
        "no-extra-bind": "error",
        "no-extra-boolean-cast": "error",
        "no-extra-label": "error",
        "no-global-assign": "error",
        "no-implicit-coercion": "error",
        "no-implicit-globals": "error",
        "no-implied-eval": "error",
        "no-inline-comments": "off", // bruh
        "no-invalid-this": "error",
        "no-iterator": "error",
        "no-label-var": "error",
        "no-labels": "error",
        "no-lone-blocks": "error",
        "no-lonely-if": "error",
        "no-loop-func": "error",

        "no-magic-numbers": ["warn", {
						ignore: [0, 1, -1],
            ignoreArrayIndexes: true,
            ignoreDefaultValues: true,
            ignoreClassFieldInitialValues: true,
        }],

        "no-multi-assign": "warn", // I've done this a lot in C
        "no-multi-str": "off",
        "no-negated-condition": "error",
        "no-nested-ternary": "off", // :>
        "no-new": "error",
        "no-new-func": "error",
        "no-new-wrappers": "error",
        "no-nonoctal-decimal-escape": "error",
        "no-object-constructor": "error",
        "no-octal": "error",
        "no-octal-escape": "error",
        "no-param-reassign": "error",
        "no-plusplus": "off",
        "no-proto": "error",
        "no-redeclare": "error",
        "no-regex-spaces": "error",
        //"no-restricted-exports": [],
        //"no-restricted-syntax": [],
        "no-return-assign": "error",
        "no-script-url": "warn", // hmm
        "no-sequences": "error",
        "no-shadow": "error",
        //"no-shadow-restricted-names": [],
        "no-ternary": "off", // ??? TERNARY MY BELOVED
        "no-throw-literal": "error",
        "no-undef-init": "error",
        "no-undefined": "error",
        "no-underscore-dangle": "error",
        "no-unneeded-ternary": "error",
        "no-unused-expressions": "error",
        "no-unused-labels": "error",
        "no-useless-call": "error",
        "no-useless-catch": "error",
        "no-useless-computed-key": "error",
        "no-useless-concat": "error",
        "no-useless-constructor": "error",
        "no-useless-escape": "error",
        "no-useless-rename": "error",
        "no-useless-return": "error",
        "no-var": "error",
        "no-void": "error",
        //"no-warning-comments": [],
        "no-with": "error",
				//"object-shorthand": "", // I don't understand this one at all
        "one-var": "off",
        "operator-assignment": ["error", "always"],
        "prefer-arrow-callback": "error",
        "prefer-const": "error",
        "prefer-destructuring": "warn", // never used this in JS outside of imports I guess
        "prefer-exponentiation-operator": "error",
        "prefer-named-capture-group": "error",
        "prefer-numeric-literals": "error",
        "prefer-object-has-own": "error",
        "prefer-object-spread": "error",
        "prefer-promise-reject-errors": "error",
        "prefer-regex-literals": "error",
        "prefer-rest-params": "error",
        "prefer-spread": "error",
        "prefer-template": "error",
        radix: "warn",
        "require-await": "error",
        "require-unicode-regexp": "error",
        "require-yield": "error",

        "sort-imports": ["error", {
            ignoreCase: true,
        }],

        "sort-keys": "off",
        "sort-vars": "off",
				//"strict": "", // doesn't seem to matter in module?
        "symbol-description": "error",
        "vars-on-top": "off",
        yoda: "error",

				// Layout & Formatting
        "unicode-bom": "error",
    },
}]);
