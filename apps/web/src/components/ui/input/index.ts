import { cva } from "class-variance-authority";

export { default as Input } from "./Input.vue";

export const inputVariants = cva(
  "flex w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "",
        focus: "border-ring ring-1 ring-ring",
        disabled: "pointer-events-none cursor-not-allowed opacity-50",
        error: "border-destructive ring-1 ring-destructive"
      },
      size: {
        md: "h-9"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "md"
    }
  }
);

export type InputVariants = typeof inputVariants;
