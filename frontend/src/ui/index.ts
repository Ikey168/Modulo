/**
 * Modulo design system — shadcn/ui component library.
 *
 * Canonical shadcn/ui components (vendored; see components.json) plus a few
 * project extensions (Spinner, EmptyState). Screens compose these primitives
 * instead of bespoke CSS. Import from '@/ui'.
 */
export { cn } from '@/lib/utils';

export { Alert, AlertTitle, AlertDescription } from './alert';
export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from './alert-dialog';
export { Avatar, AvatarImage, AvatarFallback } from './avatar';
export { Badge, badgeVariants, type BadgeProps } from './badge';
export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
} from './breadcrumb';
export { Button, buttonVariants, type ButtonProps } from './button';
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from './card';
export { Checkbox } from './checkbox';
export { Collapsible, CollapsibleTrigger, CollapsibleContent } from './collapsible';
export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from './command';
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from './dialog';
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
} from './dropdown-menu';
export { EmptyState, type EmptyStateProps } from './empty-state';
export { Input } from './input';
export { Label } from './label';
export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor } from './popover';
export { Progress } from './progress';
export { RadioGroup, RadioGroupItem } from './radio-group';
export { ScrollArea, ScrollBar } from './scroll-area';
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
} from './select';
export { Separator } from './separator';
export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from './sheet';
export { Skeleton } from './skeleton';
export { Spinner } from './spinner';
export { Switch } from './switch';
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from './table';
export { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs';
export { Textarea } from './textarea';
export {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  type ToastActionElement,
  type ToastProps,
} from './toast';
export { Toaster } from './toaster';
export { useToast, toast } from './use-toast';
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './tooltip';
