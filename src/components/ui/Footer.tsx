const Footer = () => (
  <footer className="border-t border-zinc-800 bg-zinc-950 py-6 text-center text-xs text-zinc-600 md:mb-0 mb-16">
    <p>
      SALCI &copy; {new Date().getFullYear()} &mdash; For entertainment purposes only. Not financial advice.
    </p>
    <p className="mt-1">
      <a
        href="https://x.com/SALCI"
        target="_blank"
        rel="noopener noreferrer"
        className="text-emerald-700 hover:text-emerald-500 transition-colors"
      >
        @SALCI
      </a>{' '}
      on X &bull; #SALCI
    </p>
  </footer>
);

export default Footer;
