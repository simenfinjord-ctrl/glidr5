import { ReactNode } from "react";

export function AppLink({
  href,
  children,
  testId,
  className,
}: {
  href: string;
  children: ReactNode;
  testId?: string;
  className?: string;
}) {
  return (
    <a href={href} data-testid={testId} className={className}>
      {children}
    </a>
  );
}
