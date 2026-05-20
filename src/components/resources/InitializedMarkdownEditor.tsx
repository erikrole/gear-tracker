"use client";

import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CodeToggle,
  CreateLink,
  InsertImage,
  InsertTable,
  ListsToggle,
  MDXEditor,
  Separator,
  UndoRedo,
  codeBlockPlugin,
  codeMirrorPlugin,
  diffSourcePlugin,
  headingsPlugin,
  imagePlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  type MDXEditorMethods,
  type MDXEditorProps,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";
import { forwardRef } from "react";

export type MarkdownEditorProps = Omit<MDXEditorProps, "plugins"> & {
  imageUploadHandler: (image: File) => Promise<string>;
};

export const InitializedMarkdownEditor = forwardRef<MDXEditorMethods, MarkdownEditorProps>(
  ({ imageUploadHandler, ...props }, ref) => (
    <MDXEditor
      {...props}
      ref={ref}
      plugins={[
        headingsPlugin({ allowedHeadingLevels: [1, 2, 3] }),
        listsPlugin(),
        quotePlugin(),
        linkPlugin(),
        codeBlockPlugin({ defaultCodeBlockLanguage: "text" }),
        codeMirrorPlugin({
          codeBlockLanguages: {
            text: "Text",
            markdown: "Markdown",
            javascript: "JavaScript",
            shell: "Shell",
          },
        }),
        tablePlugin(),
        thematicBreakPlugin(),
        imagePlugin({ imageUploadHandler }),
        markdownShortcutPlugin(),
        diffSourcePlugin({ viewMode: "rich-text", diffMarkdown: "" }),
        toolbarPlugin({
          toolbarContents: () => (
            <>
              <UndoRedo />
              <Separator />
              <BlockTypeSelect />
              <BoldItalicUnderlineToggles />
              <CodeToggle />
              <Separator />
              <ListsToggle />
              <CreateLink />
              <InsertImage />
              <InsertTable />
            </>
          ),
        }),
      ]}
    />
  ),
);

InitializedMarkdownEditor.displayName = "InitializedMarkdownEditor";
