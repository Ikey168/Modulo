import React, { useState } from 'react';
import { Download, FileText, Printer, FileArchive } from 'lucide-react';
import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui';
import { exportApi } from './exportApi';

interface Props {
  noteId: number;
  noteTitle?: string;
}

const ExportButton: React.FC<Props> = ({ noteId, noteTitle: _noteTitle }) => {
  const [resolveLinks, setResolveLinks] = useState(false);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm">
          <Download />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Export note
        </DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          checked={resolveLinks}
          onCheckedChange={(checked) => setResolveLinks(checked === true)}
          // Keep the menu open when toggling the option.
          onSelect={(e) => e.preventDefault()}
        >
          Resolve [[links]]
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => exportApi.downloadMarkdown(noteId, resolveLinks)}>
          <FileText className="size-4 text-muted-foreground" />
          Markdown (.md)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => exportApi.openHtmlForPrint(noteId, resolveLinks)}>
          <Printer className="size-4 text-muted-foreground" />
          <span className="flex flex-col">
            Print / PDF
            <span className="text-[11px] text-muted-foreground">Opens in browser for printing</span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => exportApi.downloadZip([noteId], resolveLinks)}>
          <FileArchive className="size-4 text-muted-foreground" />
          This note as ZIP
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ExportButton;
