import { ArrowRight, CheckCircle, MessageSquareWarning, ThumbsUp } from "lucide-react";
import { Link } from "../../contexts/MockContext";
import { Button } from "../ui/button";
import { Card, CardContent, CardFooter, CardTitle } from "../ui/card";

interface DiscussionCardProps {
  title: string;
  problemCount: number;
  solutionCount: number;
  likeCount: number;
  id?: number | string;
  themeId?: string;
}

const DiscussionCard = ({
  title,
  problemCount,
  solutionCount,
  likeCount,
  id,
  themeId,
}: DiscussionCardProps) => {
  // If no id is provided, render a non-clickable card
  if (!id) {
    return (
      <Card className="hover:shadow-md transition-all duration-200">
        <CardContent className="pt-4">
          <CardTitle className="text-base mb-2">{title}</CardTitle>
          <hr className="h-[2px] bg-gray-300 w-full my-2" />
        </CardContent>
        <CardFooter className="flex justify-between items-center pt-0">
          <div className="flex text-sm sm:text-base text-muted-foreground">
            <span className="flex items-center mr-4">
              <ThumbsUp className="h-4 w-4 mr-1 text-primary" />
              気になる: {likeCount}
            </span>
            <span className="flex items-center mr-4">
              <MessageSquareWarning className="h-4 w-4 mr-1 text-primary" />
              課題点: {problemCount}
            </span>
            <span className="flex items-center">
              <CheckCircle className="h-4 w-4 mr-1 text-primary" />
              解決策: {solutionCount}
            </span>
          </div>
          <Button className="px-3">
            <ArrowRight className="h-5 w-5" />
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // If id is provided, render a clickable card
  return (
    <Link to={`/themes/${themeId}/questions/${id}`} className="block">
      <Card className="hover:shadow-md transition-all duration-200 hover:border-primary/50">
        <CardContent className="pt-4">
          <CardTitle className="text-base mb-2">{title}</CardTitle>
          <hr className="h-[2px] bg-gray-300 w-full my-2" />
        </CardContent>
        <CardFooter className="flex justify-between items-center pt-0">
          <div className="flex text-sm sm:text-base text-muted-foreground">
            <span className="flex items-center mr-4">
              <ThumbsUp className="h-4 w-4 mr-1 text-primary" />
              気になる: {likeCount}
            </span>
            <span className="flex items-center mr-4">
              <MessageSquareWarning className="h-4 w-4 mr-1 text-primary" />
              課題点: {problemCount}
            </span>
            <span className="flex items-center">
              <CheckCircle className="h-4 w-4 mr-1 text-primary" />
              解決策: {solutionCount}
            </span>
          </div>
          <Button className="px-3">
            <ArrowRight className="h-5 w-5" />
          </Button>
        </CardFooter>
      </Card>
    </Link>
  );
};

export default DiscussionCard;
