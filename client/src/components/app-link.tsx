import { ReactNode } from "react";
import { Link } from "wouter";

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
    <Link href={href}>
      <a data-testid={testId} className={className}>
        {children}
      </a>
    </Link>
  );
}
