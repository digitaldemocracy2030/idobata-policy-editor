import React from "react";
import type { FC, ReactNode } from "react";

interface AlertProps {
  children: ReactNode;
  type?: "success" | "error" | "warning" | "info";
}

const Alert: FC<AlertProps> = ({ children, type = "info" }) => {
  const typeStyles = {
    success: "bg-green-100 text-green-700",
    error: "bg-red-100 text-red-700",
    warning: "bg-yellow-100 text-yellow-700",
    info: "bg-blue-100 text-blue-700",
  };

  return (
    <div className={`p-4 rounded mb-4 ${typeStyles[type]}`}>{children}</div>
  );
};

export default Alert;
