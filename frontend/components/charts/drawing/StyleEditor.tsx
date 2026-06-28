'use client';

/**
 * StyleEditor — edits the selected mark's style (color, width, dash) and, for
 * TEXT marks, the label text. Changes apply live via `onChange`.
 *
 * @module components/charts/drawing/StyleEditor
 */

import { type JSX } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type { DrawingStyle, DrawingType } from './types';

interface StyleEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: DrawingType | null;
  style: DrawingStyle | null;
  onChange: (patch: Partial<DrawingStyle>) => void;
}

const WIDTHS = [1, 2, 3, 4, 5, 6];

export function StyleEditor({
  open,
  onOpenChange,
  type,
  style,
  onChange,
}: StyleEditorProps): JSX.Element {
  const color = typeof style?.color === 'string' ? style.color : '#2962FF';
  const lineWidth = typeof style?.lineWidth === 'number' ? style.lineWidth : 2;
  const lineStyle =
    style?.lineStyle === 'dashed' || style?.lineStyle === 'dotted'
      ? style.lineStyle
      : 'solid';
  const text = typeof style?.['text'] === 'string' ? style['text'] : 'Text';
  const isText = type === 'TEXT';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Style</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {isText && (
            <div className="space-y-2">
              <Label htmlFor="style-text">Text</Label>
              <Input
                id="style-text"
                value={text}
                maxLength={200}
                onChange={(e) => onChange({ text: e.target.value })}
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label htmlFor="style-color">Color</Label>
            <input
              id="style-color"
              type="color"
              value={color}
              onChange={(e) => onChange({ color: e.target.value })}
              className="h-8 w-12 cursor-pointer rounded border border-[#2a2e39] bg-transparent"
            />
          </div>

          {!isText && (
            <>
              <div className="space-y-2">
                <Label htmlFor="style-width">Line width</Label>
                <Select
                  value={String(lineWidth)}
                  onValueChange={(v) => onChange({ lineWidth: Number(v) })}
                >
                  <SelectTrigger id="style-width">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WIDTHS.map((w) => (
                      <SelectItem key={w} value={String(w)}>
                        {w}px
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="style-dash">Line style</Label>
                <Select
                  value={lineStyle}
                  onValueChange={(v) =>
                    onChange({
                      lineStyle: v as DrawingStyle['lineStyle'],
                    })
                  }
                >
                  <SelectTrigger id="style-dash">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solid">Solid</SelectItem>
                    <SelectItem value="dashed">Dashed</SelectItem>
                    <SelectItem value="dotted">Dotted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
