import type { Metadata } from "next";
import Link from "next/link";
import "./styles.css";
import ThemeToggle from "./ThemeToggle";

export const metadata: Metadata = {
  title: "YouTube AI Manager",
  description: "Auditable AI-assisted YouTube production control center",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{__html:`try{document.documentElement.dataset.theme=localStorage.getItem('youtube-manager-theme')||((matchMedia('(prefers-color-scheme: light)').matches)?'light':'dark')}catch(e){}`}}/></head>
      <body>
        <header className="topbar">
          <Link className="brand" href="/"><span className="brand-mark">▶</span><span>YouTube AI Manager</span></Link>
          <div className="header-actions"><nav><Link href="/">My videos</Link><Link href="/analytics">Results</Link><Link href="/settings">Channel setup</Link><Link className="advanced-nav" href="/system">System</Link></nav><ThemeToggle/></div>
        </header>
        <main className="shell">{children}</main>
      </body>
    </html>
  );
}
