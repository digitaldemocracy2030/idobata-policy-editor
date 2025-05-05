import * as React from "react";
import { Sheet, SheetContent } from "../base/sheet";

// Chat-specific sheet content component
const ChatSheetContent = React.forwardRef<
  React.ElementRef<typeof SheetContent>,
  React.ComponentPropsWithoutRef<typeof SheetContent>
>(({ className, children, ...props }, ref) => (
  <SheetContent ref={ref} className={className} side="bottom" {...props}>
    {children}
  </SheetContent>
));
ChatSheetContent.displayName = "ChatSheetContent";

// Re-export base components with chat-specific names
export { Sheet as ChatSheet, ChatSheetContent };
