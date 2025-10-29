import { ComponentChildren } from 'preact';
import { layoutStyles } from '../styles/layout';

interface LayoutProps {
  children: ComponentChildren;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div class={layoutStyles.root}>
      {children}
    </div>
  );
}
