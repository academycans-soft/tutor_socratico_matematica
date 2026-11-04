"use client";

import React from 'react';
import katex from 'katex';

interface MathTextProps {
  content?: string;
  text?: string;
  className?: string;
}

export const MathText: React.FC<MathTextProps> = ({ content, text, className = '' }) => {
  const actualContent = content || text || '';
  if (!actualContent) return null;

  // Split on $$...$$ (block) and $...$ (inline)
  const renderMathContent = () => {
    const raw = String(actualContent || '');
    const parts = raw.split(/(\$\$[\s\S]*?\$\$|\$[^\$]+?\$)/g);

    return parts.map((part, index) => {
      if (part.startsWith('$$') && part.endsWith('$$')) {
        const math = part.slice(2, -2);
        try {
          const html = katex.renderToString(math, { displayMode: true, throwOnError: false });
          return <span key={index} dangerouslySetInnerHTML={{ __html: html }} className="my-2 block text-center" />;
        } catch (_) {
          return <span key={index}>{part}</span>;
        }
      } else if (part.startsWith('$') && part.endsWith('$')) {
        const math = part.slice(1, -1);
        try {
          const html = katex.renderToString(math, { displayMode: false, throwOnError: false });
          return <span key={index} dangerouslySetInnerHTML={{ __html: html }} />;
        } catch (_) {
          return <span key={index}>{part}</span>;
        }
      }
      return <span key={index}>{part}</span>;
    });
  };

  return <span className={`leading-relaxed ${className}`}>{renderMathContent()}</span>;
};
