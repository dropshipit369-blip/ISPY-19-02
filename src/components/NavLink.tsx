import { NavLink as RouterNavLink, NavLinkProps } from "react-router-dom";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface NavLinkCompatProps extends Omit<NavLinkProps, "className"> {
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
}

/**
 * A wrapper around React Router's NavLink that provides compatibility
 * with className-based styling for active and pending states.
 *
 * @param className - Base CSS classes applied to the link
 * @param activeClassName - Additional CSS classes when the link is active
 * @param pendingClassName - Additional CSS classes when the link is in a pending state
 * @param to - The path or location to link to
 * @param props - Other NavLink props from React Router
 */
const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, pendingClassName, to, ...props }, ref) => {
    return (
      <RouterNavLink
        ref={ref}
        to={to}
        className={({ isActive, isPending }) =>
          cn(className, isActive && activeClassName, isPending && pendingClassName)
        }
        {...props}
      />
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
