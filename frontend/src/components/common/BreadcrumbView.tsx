import { Link } from "../../contexts/MockContext";

interface BreadcrumbItem {
  label: string;
  href: string;
}

interface BreadcrumbViewProps {
  items: BreadcrumbItem[];
}

function BreadcrumbView({ items }: BreadcrumbViewProps) {
  return (
    <nav className="text-sm text-muted-foreground mb-4" aria-label="Breadcrumb">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`}>
          <Link to={item.href} className="underline">
            {item.label}
          </Link>
          {index < items.length - 1 && " ＞ "}
        </span>
      ))}
    </nav>
  );
}

export default BreadcrumbView;
