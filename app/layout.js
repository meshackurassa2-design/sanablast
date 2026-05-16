import "./globals.css";
import GlobalCompose from "@/components/GlobalCompose";

export const metadata = {
  title: "Sanaa Blast UDSM | The Creative Explosion",
  description: "Official social platform for the Sanaa Blast festival at the University of Dar es Salaam.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" style={{ backgroundColor: '#ffffff' }}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body style={{ backgroundColor: '#ffffff', margin: 0, padding: 0 }}>
        {children}
        <GlobalCompose />
        <style dangerouslySetInnerHTML={{ __html: `
          body { background-color: #ffffff !important; }
        ` }} />
      </body>
    </html>
  );
}
