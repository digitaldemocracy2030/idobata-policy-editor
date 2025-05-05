import React, {
  createContext,
  useContext,
  ReactNode,
  useCallback,
} from "react";
import {
  NavigateOptions,
  Link as RouterLink,
  LinkProps as RouterLinkProps,
  To,
  useNavigate as useRouterNavigate,
  useSearchParams,
} from "react-router-dom";

interface MockContextProps {
  isMockMode: boolean;
}

const MockContext = createContext<MockContextProps | undefined>(undefined);

export const MockProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [searchParams] = useSearchParams();

  const isMockMode = searchParams.get("mock") === "true";

  return (
    <MockContext.Provider value={{ isMockMode }}>
      {children}
    </MockContext.Provider>
  );
};

export const useMock = (): MockContextProps => {
  const context = useContext(MockContext);
  if (context === undefined) {
    throw new Error("useMock must be used within a MockProvider");
  }
  return context;
};

const addMockParam = (path: To, isMockMode: boolean): To => {
  if (!isMockMode) {
    return path;
  }

  if (typeof path === "string") {
    const [pathname, search] = path.split("?");
    const params = new URLSearchParams(search);
    params.set("mock", "true");
    return `${pathname}?${params.toString()}`;
  }

  if (typeof path === "object" && path !== null) {
    const currentSearch = path.search || "";
    const params = new URLSearchParams(currentSearch);
    params.set("mock", "true");
    return { ...path, search: params.toString() };
  }
  // 不明な形式の場合はそのまま返す
  return path;
};

export const Link: React.FC<RouterLinkProps> = ({ to, ...props }) => {
  const { isMockMode } = useMock();
  const modifiedTo = addMockParam(to, isMockMode);
  return <RouterLink to={modifiedTo} {...props} />;
};

export const useNavigate = () => {
  const originalNavigate = useRouterNavigate();
  const { isMockMode } = useMock();

  const navigate = useCallback(
    (to: To | number, options?: NavigateOptions) => {
      if (typeof to === "number") {
        originalNavigate(to);
      } else {
        const modifiedTo = addMockParam(to, isMockMode);
        originalNavigate(modifiedTo, options);
      }
    },
    [originalNavigate, isMockMode]
  );

  return navigate;
};
