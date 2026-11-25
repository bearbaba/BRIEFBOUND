import type {Metadata} from "next";
import "./globals.css";
export const metadata:Metadata={title:"BRIEFBOUND | Scope agreements for clients and freelancers",description:"Agree on a scope, review changes together, and verify decisions on GenLayer Studionet. Public community beta."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
