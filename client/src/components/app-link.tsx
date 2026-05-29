import { ReactNode } from "react";
import { Link } from "wouter";

export function AppLink({
  href,
  children,
  testId,
  className,
  title,
  dataTour,
}: {
  href: string;
  children: ReactNode;
  testId?: string;
  className?: string;
  title?: string;
  dataTour?: string;
}) {
  return (
    <Link href={href} data-testid={testId} data-tour={dataTour} className={className} title={title}>
      {children}
    </Link>
  );
}
