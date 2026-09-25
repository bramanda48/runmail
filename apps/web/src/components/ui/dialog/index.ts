import { cva } from "class-variance-authority";

export { DialogClose, DialogOverlay, DialogPortal, DialogRoot, DialogTrigger } from "reka-ui";
export { default as DialogContent } from "./DialogContent.vue";
export { default as DialogDescription } from "./DialogDescription.vue";
export { default as DialogFooter } from "./DialogFooter.vue";
export { default as DialogHeader } from "./DialogHeader.vue";
export { default as DialogTitle } from "./DialogTitle.vue";

export const dialogContentVariants = cva(
  "fixed left-1/2 top-1/2 z-50 grid w-full -translate-x-1/2 -translate-y-1/2 gap-4 border bg-surface p-6 shadow-sm outline-none",
  {
    variants: {
      variant: {
        default: "border-border",
        destructive: "border-destructive",
      },
      size: {
        sm: "max-w-sm rounded-xl",
        md: "max-w-lg rounded-2xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

export type DialogContentVariants = typeof dialogContentVariants;
