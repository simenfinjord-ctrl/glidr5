import { ReactNode } from "react";
import { Link } from "wouter";

export function AppLink({
  href,
  children,
  testId,
  className,
  title,
}: {
  href: string;
  children: ReactNode;
  testId?: string;
  className?: string;
  title?: string;
}) {
  return (
    <Link href={href} data-testid={testId} className={className} title={title}>
      {children}
    </Link>
  );
}
