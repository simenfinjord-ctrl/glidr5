// © 2025 Glidr — Proprietary and confidential. All rights reserved.
//
// Date/time inputs that start BLANK: the date opens the native calendar on
// click, with a thin "Today" link underneath; the time starts at 00:00 (or
// blank) with a "Right now" link underneath.
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";

export function DateField({ value, onChange, className, inputClassName, required, testId }: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  inputClassName?: string;
  required?: boolean;
  testId?: string;
}) {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  return (
    <div className={className}>
      <Input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className={inputClassName}
        data-testid={testId}
      />
      <button
        type="button"
        onClick={() => onChange(new Date().toISOString().slice(0, 10))}
        className="mt-0.5 text-[10px] font-medium text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
        data-testid={testId ? `${testId}-today` : undefined}
      >
        {L("I dag", "Today")}
      </button>
    </div>
  );
}

export function TimeField({ value, onChange, className, inputClassName, testId }: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  inputClassName?: string;
  testId?: string;
}) {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  return (
    <div className={className}>
      <Input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClassName}
        data-testid={testId}
      />
      <button
        type="button"
        onClick={() => {
          const d = new Date();
          onChange(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
        }}
        className="mt-0.5 text-[10px] font-medium text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
        data-testid={testId ? `${testId}-now` : undefined}
      >
        {L("Akkurat nå", "Right now")}
      </button>
    </div>
  );
}
