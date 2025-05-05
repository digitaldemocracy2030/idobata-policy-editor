import * as React from "react";
import { type LinkProps } from "react-router-dom";
import { Link } from "../../../contexts/MockContext";
import { Sheet, SheetClose, SheetContent } from "../base/sheet";

const NavigationSheetContent = React.forwardRef<
  React.ElementRef<typeof SheetContent>,
  React.ComponentPropsWithoutRef<typeof SheetContent>
>(({ className, children, ...props }, ref) => (
  <SheetContent ref={ref} className={className} side="left" {...props}>
    {children}
  </SheetContent>
));
NavigationSheetContent.displayName = "NavigationSheetContent";

// Custom NavigationRouterLink component that closes the sheet when clicked
// This is for react-router Links
interface NavigationRouterLinkProps extends LinkProps {
  children: React.ReactNode;
}

const NavigationRouterLink: React.FC<NavigationRouterLinkProps> = ({
  children,
  ...props
}) => {
  return (
    <SheetClose asChild>
      <Link {...props}>{children}</Link>
    </SheetClose>
  );
};

// Re-export base components
export {
  Sheet as NavigationSheet,
  NavigationSheetContent,
  NavigationRouterLink,
};
