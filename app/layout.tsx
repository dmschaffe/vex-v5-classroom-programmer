import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://v5-classroom-programmer.schaffx.chatgpt.site"),
  title: "V5 Classroom Programmer",
  description: "A student-friendly VEX V5 Blocks and Python simulator for the classroom testbed.",
  openGraph: {
    title: "V5 Classroom Programmer",
    description: "Practice VEX V5 Blocks and Python with an interactive classroom testbed simulator.",
    images: [{ url: "/og.png", width: 1731, height: 909, alt: "V5 Classroom Programmer - Blocks, Python, Simulator" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "V5 Classroom Programmer",
    description: "Practice VEX V5 Blocks and Python with an interactive classroom testbed simulator.",
    images: ["/og.png"],
  },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
