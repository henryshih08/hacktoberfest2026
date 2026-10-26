import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Groundshift — A closer look at change",
  description: "Compare historical aerial and satellite imagery across the United States.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
