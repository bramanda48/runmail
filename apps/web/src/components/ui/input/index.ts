export { default as Input } from "./Input.vue";

// TEMPORARY wave-separation stub, deleted in the password-input wave: PasswordInput
// still declares `variant?: VariantProps<typeof inputVariants>["variant"]` and that
// file is owned by a later wave (this wave MUST NOT touch it), so this type-level
// binding keeps its type-only import resolving until its own reset removes the
// variant prop. Do not import; not a public API.
export declare const inputVariants: (props?: { variant?: "default" }) => string;
