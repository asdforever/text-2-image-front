import { ReactNode } from "react";

interface PageContainerProps {
  children: ReactNode;
  loading?: boolean;
  className?: string;
}

export function PageContainer({ children, loading = false, className = "" }: PageContainerProps) {
  if (loading) {
    return (
      <div className={`app-shell ${className}`}>
        <div className="page-loading">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  return <div className={`app-shell ${className}`}>{children}</div>;
}
