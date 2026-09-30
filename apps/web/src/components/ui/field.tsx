import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

const base =
  "w-full border border-line bg-bg/60 px-2.5 text-sm text-ink placeholder:text-dim focus:border-cyan/60 focus:outline-none focus:ring-0 disabled:opacity-50";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn(base, "h-9", className)} {...p} />
));
Input.displayName = "Input";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...p }, ref) => (
    <select ref={ref} className={cn(base, "h-9 appearance-none pr-6 font-mono text-xs uppercase", className)} {...p}>
      {children}
    </select>
  ),
);
Select.displayName = "Select";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...p }, ref) => <textarea ref={ref} className={cn(base, "min-h-[72px] py-2", className)} {...p} />,
);
Textarea.displayName = "Textarea";

export function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="label mb-1 block">
      {children}
    </label>
  );
}
