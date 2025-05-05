import { X } from "lucide-react";
import type React from "react";
import { SheetClose } from "../ui/base/sheet";
import { Button } from "../ui/button";

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
      <div className="w-full flex justify-center items-center ">
        <span className="w-16 h-2 bg-neutral-300 rounded-full my-1" />
      </div>
      <div className="absolute right-4 top-6">
        <SheetClose asChild>
          <Button variant="ghost" size="icon">
            <X className="h-5 w-5" />
          </Button>
        </SheetClose>
      </div>
    </div>
  );
};
