import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {default:"Протокол алгоритмічного врядування України (UAGP)",template:"%s · UAGP"},
  description:"Відкритий робочий простір для спільного розвитку Протоколу алгоритмічного врядування України. Знаходьте питання, читайте запропоновані зміни та долучайтеся до роботи.",
  robots:{index:false,follow:true},
};

export default function RootLayout({children}:{children:ReactNode}) {
  return <html lang="uk"><body>{children}</body></html>;
}
