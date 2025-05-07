import type { ReactNode } from "react";
import Footer from "./Footer";
import Header from "./Header";
import Sidebar from "./Sidebar";

interface PageLayoutProps {
  children: ReactNode;
}

const PageLayout = ({ children }: PageLayoutProps) => {
  const nowPagePath = location.pathname;
  if (nowPagePath === "/about") {
    return (
      <div className="min-h-screen flex flex-col pt-14">
        <Header />
        <Sidebar />
        <main className="flex-grow xl:ml-[260px] px-4 xl:pl-8 xl:mr-[400px]">
          {children}
        </main>
        <Footer />
      </div>
    );
  } else {
    return (
      <div className="min-h-screen flex flex-col pt-14">
        <Header />
        <Sidebar />
        <main className="flex-grow xl:ml-[260px] px-4 xl:px-8">{children}</main>
        <Footer />
      </div>
    );
  }
};

export default PageLayout;
