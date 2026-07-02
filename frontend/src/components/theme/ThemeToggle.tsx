import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../themes/ThemeContext';
import { getThemeByName } from '../../themes/themes';
import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/ui';

/** Menu order — dark-first, then light, then the tinted themes. */
const THEME_ORDER = ['dark', 'light', 'blue', 'green', 'purple'];

interface ThemeToggleProps {
  className?: string;
}

/**
 * Compact theme switcher: a ghost icon button (moon in dark mode, sun
 * otherwise) opening a DropdownMenu that lists every theme with an active
 * check mark. Theme state lives in ThemeContext (setTheme / themeName /
 * isDarkMode).
 */
const ThemeToggle = ({ className }: ThemeToggleProps) => {
  const { themeName, setTheme, isDarkMode } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={className} aria-label="Change theme">
          {isDarkMode ? <Moon /> : <Sun />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {THEME_ORDER.map((name) => (
          <DropdownMenuCheckboxItem
            key={name}
            checked={themeName === name}
            onSelect={() => setTheme(name)}
          >
            {getThemeByName(name).displayName}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ThemeToggle;
