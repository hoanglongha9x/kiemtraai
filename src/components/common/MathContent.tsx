"use client";

import { useEffect, useRef } from "react";
import renderMathInElement from "katex/contrib/auto-render";
import "katex/contrib/mhchem";

type MathContentProps = {
  text?: string;
  style?: React.CSSProperties;
  className?: string;
};

export default function MathContent({
  text = "",
  style,
  className,
}: MathContentProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    renderMathInElement(containerRef.current, {
      throwOnError: false,
      strict: false,
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false },
        { left: "$", right: "$", display: false },
      ],
    });
  }, [text]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        whiteSpace: "pre-wrap",
        lineHeight: 1.7,
        overflowWrap: "anywhere",
        ...style,
      }}
    >
      {text || ""}
    </div>
  );
}