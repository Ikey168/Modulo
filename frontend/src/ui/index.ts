/**
 * Modulo design system — primitive component library.
 *
 * Screens compose these primitives (built on Tailwind design tokens) instead of
 * bespoke inline styles or one-off CSS. Import from '@/ui'.
 */
export { cn } from './cn';
export { Button, buttonVariants, type ButtonProps } from './Button';
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from './Card';
export { Input } from './Input';
export { Textarea } from './Textarea';
export { Label } from './Label';
export { Select } from './Select';
export { Badge, badgeVariants, type BadgeProps } from './Badge';
export { Spinner } from './Spinner';
export { Modal, type ModalProps } from './Modal';
export { Tabs, type TabItem, type TabsProps } from './Tabs';
export { Switch, type SwitchProps } from './Switch';
export { Avatar, type AvatarProps } from './Avatar';
export { Separator } from './Separator';
export { Skeleton } from './Skeleton';
export { EmptyState, type EmptyStateProps } from './EmptyState';
export { Tooltip, type TooltipProps } from './Tooltip';
