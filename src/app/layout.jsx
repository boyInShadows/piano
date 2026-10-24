import { PIANO_TITLE } from '../lib/pianoConfig';
import './globals.css';

export const metadata = {
  title: PIANO_TITLE,
  description: 'A personal browser piano for free play and local recordings.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
