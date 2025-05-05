import { X } from "lucide-react";
import type React from "react";
import { Button } from "../ui/button";
import { SheetClose } from "../ui/base/sheet";

interface ChatHeaderProps {
  onDragStart: (clientY: number) => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({ onDragStart }) => {
  const handleMouseDown = (e: React.MouseEvent) => {
    onDragStart(e.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      onDragStart(e.touches[0].clientY);
    }
  };

  return (
    <div
      className="border-b flex items-center justify-center cursor-grab active:cursor-grabbing relative"
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      <div className="w-full flex flex-col items-center py-3">
        <div className="w-10 h-1 bg-neutral-300 rounded-full mb-1" />
      </div>
      <div className="absolute right-2 top-2">
        <SheetClose asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex items-center justify-center"
          >
            <X className="h-5 w-5" />
          </Button>
        </SheetClose>
      </div>
    </div>
  );
};
