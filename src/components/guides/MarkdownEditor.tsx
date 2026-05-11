"use client";

import dynamic from "next/dynamic";
import { forwardRef } from "react";
import type { MDXEditorMethods } from "@mdxeditor/editor";
import type { MarkdownEditorProps } from "./InitializedMarkdownEditor";

const Editor = dynamic(
  () => import("./InitializedMarkdownEditor").then((mod) => mod.InitializedMarkdownEditor),
  { ssr: false },
);

export const MarkdownEditor = forwardRef<MDXEditorMethods, MarkdownEditorProps>((props, ref) => (
  <Editor {...props} ref={ref} />
));

MarkdownEditor.displayName = "MarkdownEditor";
