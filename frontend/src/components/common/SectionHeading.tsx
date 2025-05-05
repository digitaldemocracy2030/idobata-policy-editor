import { cn } from "../../lib/utils";

interface SectionHeadingProps {
  title: string;
  className?: string;
}

function SectionHeading({ title, className }: SectionHeadingProps) {
  return (
    <div className={cn("flex py-2 mb-3 items-center", className)}>
      <span className="w-[6px] h-8 bg-primary rounded-full mr-2" />
      <h2 className="text-2xl md:text-3xl text-foreground font-biz leading-6">
        {title}
      </h2>
    </div>
  );
}

export default SectionHeading;
