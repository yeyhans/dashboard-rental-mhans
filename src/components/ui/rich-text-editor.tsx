import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import * as DOMPurifyModule from 'dompurify';

const DOMPurify = (DOMPurifyModule.default || DOMPurifyModule) as typeof DOMPurifyModule.default;
import { useEffect, useCallback, useRef } from 'react';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Link as LinkIcon,
  Unlink,
  Undo,
  Redo,
  RemoveFormatting,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

function ToolbarButton({
  active,
  onClick,
  icon: Icon,
  label,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          className={cn(
            'inline-flex items-center justify-center rounded-sm h-8 w-8 text-sm transition-colors',
            'hover:bg-accent hover:text-accent-foreground',
            'disabled:pointer-events-none disabled:opacity-50',
            active && 'bg-accent text-accent-foreground',
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Escribe aquí...',
  className,
  minHeight = '120px',
}: RichTextEditorProps) {
  const isUpdatingRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm max-w-none focus:outline-none text-foreground dark:prose-invert',
          'prose-headings:text-foreground prose-headings:font-semibold',
          'prose-p:text-foreground prose-p:leading-relaxed',
          'prose-strong:text-foreground prose-li:text-foreground',
          'prose-a:text-primary prose-a:underline',
          '[&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2',
        ),
        style: `min-height: ${minHeight}`,
      },
    },
    onUpdate: ({ editor }) => {
      if (isUpdatingRef.current) return;
      const html = editor.isEmpty ? '' : DOMPurify.sanitize(editor.getHTML());
      onChange(html);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const currentHtml = editor.isEmpty ? '' : editor.getHTML();
    const normalizedValue = value || '';
    if (normalizedValue !== currentHtml) {
      isUpdatingRef.current = true;
      editor.commands.setContent(normalizedValue, false);
      isUpdatingRef.current = false;
    }
  }, [value, editor]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL del enlace:', previousUrl || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn('rounded-md border border-input bg-background', className)}>
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-2 py-1.5 bg-muted/30">
          <ToolbarButton
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
            icon={Bold}
            label="Negrita"
          />
          <ToolbarButton
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            icon={Italic}
            label="Cursiva"
          />
          <ToolbarButton
            active={editor.isActive('underline')}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            icon={UnderlineIcon}
            label="Subrayado"
          />

          <div className="mx-1 h-6 w-px bg-border" />

          <ToolbarButton
            active={editor.isActive('heading', { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            icon={Heading2}
            label="Título H2"
          />
          <ToolbarButton
            active={editor.isActive('heading', { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            icon={Heading3}
            label="Título H3"
          />

          <div className="mx-1 h-6 w-px bg-border" />

          <ToolbarButton
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            icon={List}
            label="Lista"
          />
          <ToolbarButton
            active={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            icon={ListOrdered}
            label="Lista numerada"
          />

          <div className="mx-1 h-6 w-px bg-border" />

          <ToolbarButton
            active={editor.isActive('link')}
            onClick={setLink}
            icon={LinkIcon}
            label="Insertar enlace"
          />
          {editor.isActive('link') && (
            <ToolbarButton
              active={false}
              onClick={() => editor.chain().focus().unsetLink().run()}
              icon={Unlink}
              label="Quitar enlace"
            />
          )}

          <div className="mx-1 h-6 w-px bg-border" />

          <ToolbarButton
            active={false}
            onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
            icon={RemoveFormatting}
            label="Limpiar formato"
          />

          <div className="ml-auto flex items-center gap-0.5">
            <ToolbarButton
              active={false}
              onClick={() => editor.chain().focus().undo().run()}
              icon={Undo}
              label="Deshacer"
              disabled={!editor.can().undo()}
            />
            <ToolbarButton
              active={false}
              onClick={() => editor.chain().focus().redo().run()}
              icon={Redo}
              label="Rehacer"
              disabled={!editor.can().redo()}
            />
          </div>
        </div>

        {/* Editor content */}
        <div className="px-3 py-2">
          <EditorContent editor={editor} />
        </div>
      </div>
    </TooltipProvider>
  );
}
