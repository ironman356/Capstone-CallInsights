import type { ReactNode } from 'react';

interface PageFrameProps {
  title: string;
  children?: ReactNode;
  className?: string;
}

export default function PageFrame({ title, children, className }: PageFrameProps) {
  return (
    <section className={className ? `page-frame ${className}` : 'page-frame'}>
      <h1 className="page-title">{title}</h1>
      {children}
    </section>
  );
}

