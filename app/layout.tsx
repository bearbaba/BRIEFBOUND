import type {Metadata} from "next";
import "./globals.css";
export const metadata:Metadata={title:"BRIEFBOUND | Evidence-first scope decisions",description:"Two signed GenLayer contracts connect design briefs to revision decisions."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
