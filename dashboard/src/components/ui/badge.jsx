import { cva } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-blue-600/20 text-blue-400",
        secondary: "border-transparent bg-gray-800 text-gray-300",
        destructive: "border-transparent bg-red-600/20 text-red-400",
        success: "border-transparent bg-green-600/20 text-green-400",
        warning: "border-transparent bg-yellow-600/20 text-yellow-400",
        outline: "border-gray-700 text-gray-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
