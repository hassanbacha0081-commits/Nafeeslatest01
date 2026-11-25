import React from 'react';

interface PhoneChannelLogosProps {
  size?: number;
  className?: string;
}

export const WhatsAppLogo: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="WhatsApp"
    style={{ display: 'block', flexShrink: 0 }}
  >
    <path
      d="M16 2C8.27 2 2 8.15 2 15.74c0 2.7.79 5.29 2.28 7.51L2.1 30l6.97-2.12A14.08 14.08 0 0 0 16 29.48c7.73 0 14-6.15 14-13.74S23.73 2 16 2z"
      fill="#25D366"
    />
    <path
      d="M22.55 19.35c-.35-.18-2.08-1.02-2.4-1.14-.32-.12-.56-.18-.79.18-.23.35-.91 1.14-1.11 1.37-.21.23-.41.26-.76.09-.35-.18-1.49-.55-2.83-1.74-1.05-.93-1.75-2.08-1.96-2.43-.2-.35-.02-.54.15-.71.16-.16.35-.41.53-.62.18-.2.23-.35.35-.59.12-.23.06-.44-.03-.62-.09-.18-.79-1.9-1.08-2.61-.29-.69-.58-.59-.79-.6-.21-.01-.44-.01-.68-.01-.23 0-.62.09-.94.44-.32.35-1.23 1.2-1.23 2.93s1.26 3.4 1.44 3.63c.18.23 2.48 3.78 6.01 5.3.84.36 1.5.58 2.01.74.84.27 1.61.23 2.22.14.68-.1 2.08-.85 2.38-1.67.29-.82.29-1.52.2-1.67-.08-.15-.32-.24-.67-.41z"
      fill="#FFFFFF"
    />
  </svg>
);

export const EasyPaisaLogo: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="EasyPaisa"
    style={{ display: 'block', flexShrink: 0 }}
  >
    <rect x="1.5" y="1.5" width="29" height="29" rx="7.5" fill="#00AA4F" />
    {/* Stylized 'e' */}
    <path
      d="M 14.5 14.5 A 3.9 4.2 0 1 0 13.5 17.8"
      stroke="#FFFFFF"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    <line
      x1="7.1"
      y1="14.5"
      x2="14.5"
      y2="14.5"
      stroke="#FFFFFF"
      strokeWidth="2.4"
      strokeLinecap="round"
    />
    {/* Stylized 'p' */}
    <line
      x1="18.3"
      y1="11.0"
      x2="18.3"
      y2="22.8"
      stroke="#FFFFFF"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    <circle
      cx="21.7"
      cy="14.5"
      r="3.4"
      stroke="#FFFFFF"
      strokeWidth="2.5"
    />
  </svg>
);

export const PhoneChannelLogos: React.FC<PhoneChannelLogosProps> = ({ size = 16, className }) => (
  <span
    className={className}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      flexShrink: 0,
      lineHeight: 1
    }}
  >
    <WhatsAppLogo size={size} />
    <EasyPaisaLogo size={size} />
  </span>
);
