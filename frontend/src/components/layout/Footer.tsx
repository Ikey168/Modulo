import { Link } from 'react-router-dom';

const Footer = () => (
  <footer className="mt-auto border-t border-border">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-6 py-2.5 max-md:px-4">
      <span className="text-xxs text-muted-foreground">© {new Date().getFullYear()} Modulo</span>
      <nav aria-label="Footer" className="flex items-center gap-4 text-xxs">
        <Link to="/about" className="text-muted-foreground transition-colors hover:text-foreground">
          About
        </Link>
        <a
          href="https://github.com/Ikey168/Modulo"
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          GitHub
        </a>
      </nav>
    </div>
  </footer>
);

export default Footer;
