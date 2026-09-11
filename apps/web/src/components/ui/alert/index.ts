import { cva } from "class-variance-authority";

export { default as Alert } from "./Alert.vue";

export const alertVariants = cva(
  "relative flex w-full items-start gap-3 rounded-lg border p-4 text-sm [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        info: "border-border/50 bg-primary/20 text-primary-foreground",
        success: "border-success/30 bg-success/15 text-success",
        warning: "border-warning/30 bg-warning/15 text-warning",
        error: "border-destructive/30 bg-destructive/15 text-destructive"
      }
    },
    defaultVariants: {
      variant: "info"
    }
  }
);

export type AlertVariants = typeof alertVariants;
