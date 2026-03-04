import './globals.css'

export const metadata = {
  title: 'Roundtable — where AI plans',
  description: 'AI Agent Command Center — Multi-team AI orchestration platform',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                var theme = localStorage.getItem('roundtable-theme') || 'dark';
                document.documentElement.setAttribute('data-theme', theme);
                if (theme === 'light') document.documentElement.classList.add('light');
              } catch(e) {}
            })();
          `
        }} />
      </head>
      <body className="bg-dark-900 text-white antialiased">
        {children}
      </body>
    </html>
  )
}
