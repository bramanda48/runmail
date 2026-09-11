import { cva } from "class-variance-authority";

export { default as Badge } from "./Badge.vue";

export const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        success: "border-success/20 bg-success/15 text-success",
        inactive: "border-transparent bg-muted text-muted-foreground",
        pending: "border-warning/20 bg-warning/15 text-warning",
        error: "border-destructive/20 bg-destructive/15 text-destructive"
      }
    },
    defaultVariants: {
      variant: "inactive"
    }
  }
);

export type BadgeVariants = typeof badgeVariants;
