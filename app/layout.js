import './globals.css'

export const metadata = {
  title: 'Songfinch Mission Control',
  description: 'AI Agent Dashboard for Songfinch Creative Operations',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-dark-900 text-white antialiased">
        {children}
      </body>
    </html>
  )
}
