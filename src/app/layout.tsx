import type { Viewport } from 'next';
import { Geist } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const KAKAO_JS_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;

const geistSans = Geist({
  variable: '--font-sans',
  subsets: ['latin'],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#E8554E',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className={`${geistSans.variable} h-full`} suppressHydrationWarning>
      <head>
        {/* CDN preconnect */}
        <link rel="preconnect" href="https://t1.daumcdn.net" />
        <link rel="preconnect" href="https://dapi.kakao.com" />
        <link rel="preconnect" href="https://map.daumcdn.net" />
        <link rel="preconnect" href="https://img1.kakaocdn.net" />
        <link rel="preconnect" href="https://t1.kakaocdn.net" crossOrigin="anonymous" />
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''} />
        <link rel="dns-prefetch" href="https://t1.daumcdn.net" />
        <link rel="dns-prefetch" href="https://dapi.kakao.com" />
        <link rel="dns-prefetch" href="https://map.daumcdn.net" />
        <link rel="dns-prefetch" href="https://img1.kakaocdn.net" />
        <link rel="dns-prefetch" href="https://t1.kakaocdn.net" />
        <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''} />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body className="h-full bg-background text-foreground antialiased">
        {GA_MEASUREMENT_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                var isApp = new URLSearchParams(location.search).get('platform') === 'app'
                  || !!window.Capacitor;
                gtag('config', '${GA_MEASUREMENT_ID}', {
                  app_platform: isApp ? 'webview_app' : 'web'
                });
              `}
            </Script>
          </>
        )}
        {KAKAO_JS_KEY && (
          <>
            <Script
              src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js"
              strategy="afterInteractive"
            />
            <Script id="kakao-init" strategy="afterInteractive">
              {`
                (function wait(){
                  if(window.Kakao && !window.Kakao.isInitialized()){
                    window.Kakao.init('${KAKAO_JS_KEY}');
                  } else if(!window.Kakao){
                    setTimeout(wait, 100);
                  }
                })();
              `}
            </Script>
          </>
        )}
        {children}
      </body>
    </html>
  );
}
