/** Minimal stub for next/link used in vitest. */
import React from "react";

interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children?: React.ReactNode;
  prefetch?: boolean;
}

const Link = ({ href, children, prefetch: _prefetch, ...rest }: LinkProps) => (
  <a href={href} {...rest}>
    {children}
  </a>
);

export default Link;
