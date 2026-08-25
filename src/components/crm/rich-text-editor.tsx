import { useEffect, type ComponentType } from 'react'
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Underline,
  Undo2,
} from 'lucide-react'
import { cn } from '~/lib/utils'

type Props = {
  /** HTML string (Tiptap output). Empty string renders an empty document. */
  value: string
  onChange: (html: string) => void
  disabled?: boolean
  minHeight?: number
  className?: string
}

/**
 * Rich text editor for client-facing documents (scope of work, etc.).
 *
 * - Tiptap v3 + StarterKit; content is stored as schema-conformant HTML, so
 *   rendering it back through Tiptap (read-only) can never execute anything
 *   outside the schema.
 * - `immediatelyRender: false` keeps SSR and the client hydration in sync.
 * - Toolbar active states subscribe via `useEditorState` — v3 does not
 *   re-render on every transaction by default.
 */
export function RichTextEditor({ value, onChange, disabled = false, minHeight = 240, className }: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    content: value || '',
    extensions: [StarterKit],
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'rt-content',
        style: `min-height: ${minHeight}px`,
        'aria-label': 'Rich text editor',
      },
    },
  })

  // Sync external value changes (e.g. after a server refresh rebuilds the form
  // state) without emitting an update or stomping the cursor mid-typing.
  useEffect(() => {
    if (!editor) return
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value || '', { emitUpdate: false })
    }
  }, [value, editor])

  useEffect(() => {
    editor?.setEditable(!disabled)
  }, [disabled, editor])

  return (
    <div className={cn('rt-root', disabled && 'rt-disabled', className)}>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} className="rt-frame" />
    </div>
  )
}

function Toolbar({ editor }: { editor: Editor | null }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }): ToolbarState => ({
      bold: e?.isActive('bold') ?? false,
      italic: e?.isActive('italic') ?? false,
      underline: e?.isActive('underline') ?? false,
      strike: e?.isActive('strike') ?? false,
      h1: e?.isActive('heading', { level: 1 }) ?? false,
      h2: e?.isActive('heading', { level: 2 }) ?? false,
      bulletList: e?.isActive('bulletList') ?? false,
      orderedList: e?.isActive('orderedList') ?? false,
      blockquote: e?.isActive('blockquote') ?? false,
      codeBlock: e?.isActive('codeBlock') ?? false,
      canUndo: e?.can().undo() ?? false,
      canRedo: e?.can().redo() ?? false,
    }),
  })

  return (
    <div className="rt-toolbar" role="toolbar" aria-label="Formatting">
      <ToolbarButton
        editor={editor}
        icon={Bold}
        label="Bold"
        pressed={state?.bold ?? false}
        disabled={!editor}
        onClick={(e) => e.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        editor={editor}
        icon={Italic}
        label="Italic"
        pressed={state?.italic ?? false}
        disabled={!editor}
        onClick={(e) => e.chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        editor={editor}
        icon={Underline}
        label="Underline"
        pressed={state?.underline ?? false}
        disabled={!editor}
        onClick={(e) => e.chain().focus().toggleUnderline().run()}
      />
      <ToolbarButton
        editor={editor}
        icon={Strikethrough}
        label="Strikethrough"
        pressed={state?.strike ?? false}
        disabled={!editor}
        onClick={(e) => e.chain().focus().toggleStrike().run()}
      />
      <ToolbarSeparator />
      <ToolbarButton
        editor={editor}
        icon={Heading1}
        label="Heading 1"
        pressed={state?.h1 ?? false}
        disabled={!editor}
        onClick={(e) => e.chain().focus().toggleHeading({ level: 1 }).run()}
      />
      <ToolbarButton
        editor={editor}
        icon={Heading2}
        label="Heading 2"
        pressed={state?.h2 ?? false}
        disabled={!editor}
        onClick={(e) => e.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <ToolbarSeparator />
      <ToolbarButton
        editor={editor}
        icon={List}
        label="Bullet list"
        pressed={state?.bulletList ?? false}
        disabled={!editor}
        onClick={(e) => e.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        editor={editor}
        icon={ListOrdered}
        label="Numbered list"
        pressed={state?.orderedList ?? false}
        disabled={!editor}
        onClick={(e) => e.chain().focus().toggleOrderedList().run()}
      />
      <ToolbarButton
        editor={editor}
        icon={Quote}
        label="Quote"
        pressed={state?.blockquote ?? false}
        disabled={!editor}
        onClick={(e) => e.chain().focus().toggleBlockquote().run()}
      />
      <ToolbarButton
        editor={editor}
        icon={Code}
        label="Code block"
        pressed={state?.codeBlock ?? false}
        disabled={!editor}
        onClick={(e) => e.chain().focus().toggleCodeBlock().run()}
      />
      <ToolbarButton
        editor={editor}
        icon={Minus}
        label="Divider"
        pressed={false}
        disabled={!editor}
        onClick={(e) => e.chain().focus().setHorizontalRule().run()}
      />
      <ToolbarSeparator />
      <ToolbarButton
        editor={editor}
        icon={RemoveFormatting}
        label="Clear formatting"
        pressed={false}
        disabled={!editor}
        onClick={(e) => e.chain().focus().unsetAllMarks().clearNodes().run()}
      />
      <ToolbarButton
        editor={editor}
        icon={Undo2}
        label="Undo"
        pressed={false}
        disabled={!editor || !(state?.canUndo ?? false)}
        onClick={(e) => e.chain().focus().undo().run()}
      />
      <ToolbarButton
        editor={editor}
        icon={Redo2}
        label="Redo"
        pressed={false}
        disabled={!editor || !(state?.canRedo ?? false)}
        onClick={(e) => e.chain().focus().redo().run()}
      />
    </div>
  )
}

type ToolbarState = {
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  h1: boolean
  h2: boolean
  bulletList: boolean
  orderedList: boolean
  blockquote: boolean
  codeBlock: boolean
  canUndo: boolean
  canRedo: boolean
}

function ToolbarButton({
  editor,
  icon: Icon,
  label,
  pressed,
  disabled,
  onClick,
}: {
  editor: Editor | null
  icon: ComponentType<{ size?: number | string }>
  label: string
  pressed: boolean
  disabled?: boolean
  onClick: (editor: Editor) => void
}) {
  return (
    <button
      type="button"
      className={cn('rt-btn', pressed && 'rt-btn-active')}
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={() => {
        if (editor) onClick(editor)
      }}
    >
      <Icon size={14} />
    </button>
  )
}

function ToolbarSeparator() {
  return <span className="rt-sep" aria-hidden="true" />
}
