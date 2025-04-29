import { ArrowRight, HelpCircle, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";

interface ThemeCardProps {
  id?: number | string;
  title: string;
  description?: string;
  keyQuestionCount?: number;
  commentCount?: number;
  problemCount?: number;
  solutionCount?: number;
}

const ThemeCard = ({
  id,
  title,
  description,
  keyQuestionCount,
  commentCount,
  problemCount,
  solutionCount,
}: ThemeCardProps) => {
  if (
    description !== undefined &&
    keyQuestionCount !== undefined &&
    commentCount !== undefined
  ) {
    return (
      <div className="border border-neutral-200 rounded-lg p-4 bg-white hover:shadow-md transition-all duration-200">
        <h3 className="font-semibold text-lg mb-2">{title}</h3>
        <p className="text-sm text-neutral-600 mb-4">{description}</p>
        <div className="flex justify-between items-center">
          <div className="flex text-xs text-neutral-600">
            <span className="flex items-center mr-4">
              <HelpCircle className="h-4 w-4 mr-1 text-purple-500" />
              キークエスチョン: {keyQuestionCount}件
            </span>
            <span className="flex items-center">
              <MessageSquare className="h-4 w-4 mr-1 text-purple-500" />
              関連意見: {commentCount}件
            </span>
          </div>
          <Link
            to={`/themes/${id}`}
            className="bg-purple-500 text-white p-1 rounded-md inline-block"
          >
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-neutral-200 rounded-lg p-4 bg-white hover:shadow-md transition-all duration-200">
      <div className="mb-2">
        <h3 className="font-semibold text-base">{title}</h3>
      </div>
      <div className="flex justify-between items-center">
        <div className="flex text-xs text-neutral-600">
          <span className="flex items-center mr-4">
            <HelpCircle className="h-4 w-4 mr-1 text-purple-500" />
            課題点: {problemCount}
          </span>
          <span className="flex items-center">
            <MessageSquare className="h-4 w-4 mr-1 text-purple-500" />
            解決策: {solutionCount}
          </span>
        </div>
        <Link
          to={`/themes/${id}`}
          className="bg-purple-500 text-white p-1 rounded-md inline-block"
        >
          <ArrowRight className="h-5 w-5" />
        </Link>
      </div>
    </div>
  );
};

export default ThemeCard;
