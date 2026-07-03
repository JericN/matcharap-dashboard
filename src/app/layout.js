import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Footer from "@/components/Footer";
import Doodles from "@/components/Doodles";
import CalculatorWidget from "@/components/CalculatorWidget";

export const metadata = {
  title: "Matcharap Eto · Vendor Board",
  description:
    "Matcharap Eto — matcha pop-up events around Metro Manila, a drink cost calculator, and a matcha powder sourcing guide.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Caveat:wght@500;600;700&family=Shantell+Sans:ital,wght@0,400;0,600;0,700;1,500&family=DM+Mono:ital,wght@0,400;0,500;1,400&family=Nunito+Sans:opsz,wght@6..12,400;6..12,600;6..12,700&display=swap"
        />
      </head>
      <body>
        <Doodles />
        <Sidebar />
        <div className="md:pl-[216px]">
          <div className="max-w-[1140px] mx-auto px-5 pt-[26px] pb-[70px] max-md:px-[13px] max-md:pt-4 max-md:pb-14">
            {children}
            <Footer />
          </div>
        </div>
        <CalculatorWidget />
      </body>
    </html>
  );
}
