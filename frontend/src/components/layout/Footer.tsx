import { Link } from 'react-router-dom';
import { ModuloMark } from '../../features/home/brand';

const Footer = () => (
  <footer className="mt-auto border-t border-border bg-surface">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-4 max-md:px-4">
      <div className="flex items-center gap-2">
        <ModuloMark size={16} className="text-primary" />
        <span className="text-[13px] font-semibold tracking-tight text-foreground">Modulo</span>
        <span className="text-xxs text-muted-foreground">
          © {new Date().getFullYear()} Modulo. All rights reserved.
        </span>
      </div>
      <nav aria-label="Footer" className="flex items-center gap-4 text-[13px]">
        <Link to="/about" className="text-subtle-foreground transition-colors hover:text-foreground">
          About
        </Link>
        <a
          href="https://github.com/Ikey168/Modulo"
          target="_blank"
          rel="noreferrer"
          className="text-subtle-foreground transition-colors hover:text-foreground"
        >
          GitHub
        </a>
      </nav>
    </div>
  </footer>
);

export default Footer;
