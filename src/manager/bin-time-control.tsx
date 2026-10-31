// The bin time in Options: a row with a select of common lengths, and Custom
// for an amount in hours or days under it.
import { useEffect, useId, useRef, useState } from "react";
import { NumberField } from "@base-ui/react/number-field";
import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import {
  type Unit,
  PRESETS,
  amountError,
  convert,
  duration,
  isPreset,
  join,
  maxAmount,
  split,
} from "./bin-time.ts";
import { plural } from "./library.ts";
import { icon } from "./ui-icons.tsx";
import { buttonVariants } from "./ui/button.tsx";
import { cn } from "./ui/cn.ts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./ui/select.tsx";

const CUSTOM = "custom";
const UNITS: { value: Unit; label: string }[] = [
  { value: "hours", label: "Hours" },
  { value: "days", label: "Days" },
];
// A segmented track, on radios: a unit is a choice, not a tab.
const segmentList =
  "flex h-8 shrink-0 gap-0.5 rounded-[10px] bg-recess p-0.75 shadow-[inset_0_0_0_1px_var(--tt-line)]";
const segment =
  "inline-flex flex-1 cursor-default items-center justify-center rounded-[7px] px-3 font-medium whitespace-nowrap text-ink-2 outline-none select-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-checked:bg-well data-checked:text-ink-0 data-checked:shadow-[inset_0_0_0_1px_var(--tt-line-2),0_1px_2px_rgb(0_0_0/0.2)]";
const stepButton = cn(
  buttonVariants({ variant: "ghost", size: "icon-xs" }),
  "shrink-0",
);

function AmountUnit({
  value,
  onChange,
  onErrorChange,
  labelledBy,
}: {
  value: number;
  onChange: (hours: number) => void;
  onErrorChange: (error: string) => void;
  labelledBy: string;
}) {
  const [initial] = useState(() => split(value));
  const [amount, setAmount] = useState<number | null>(initial.amount);
  const [unit, setUnit] = useState<Unit>(initial.unit);
  const errorId = useId();
  const error = amountError(amount ?? Number.NaN, unit);
  const report = useRef(onErrorChange);
  useEffect(() => {
    report.current = onErrorChange;
  });
  useEffect(() => {
    report.current(error);
  }, [error]);
  useEffect(() => () => report.current(""), []);

  function update(nextAmount: number | null, nextUnit: Unit) {
    setAmount(nextAmount);
    setUnit(nextUnit);
    if (nextAmount !== null && !amountError(nextAmount, nextUnit))
      onChange(join(nextAmount, nextUnit));
  }
  function changeUnit(nextUnit: Unit) {
    if (nextUnit === unit) return;
    update(
      amount !== null && Number.isFinite(amount)
        ? convert(amount, unit, nextUnit)
        : amount,
      nextUnit,
    );
  }
  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      className="@container flex flex-col gap-2 px-2.5 pb-2.5 animate-in duration-150 fade-in-0 slide-in-from-top-1"
    >
      {/* One row when it fits; in a narrow dialog the two controls stack. */}
      <div className="grid gap-2 @2xs:flex @2xs:items-center">
        <NumberField.Root
          value={amount}
          onValueChange={(next) => update(next, unit)}
          min={1}
          max={maxAmount(unit)}
          step={1}
          largeStep={unit === "days" ? 7 : 24}
          allowOutOfRange
          format={{ useGrouping: false }}
        >
          <NumberField.Group
            data-slot="input-group"
            className="group/input-group relative flex h-8 w-full min-w-0 items-center rounded-lg bg-raised px-1 shadow-[inset_0_0_0_1px_var(--tt-line-2)] transition-shadow outline-none has-[[data-slot=input-group-control]:focus-visible]:shadow-[inset_0_0_0_1px_var(--tt-focus)] has-[[aria-invalid=true]]:shadow-[inset_0_0_0_1px_var(--destructive)] @2xs:w-32"
          >
            <NumberField.Decrement className={stepButton}>
              {icon("minus")}
            </NumberField.Decrement>
            <NumberField.Input
              id="bin-amount"
              data-slot="input-group-control"
              role="spinbutton"
              aria-label="Amount"
              aria-valuemin={1}
              aria-valuemax={maxAmount(unit)}
              aria-valuenow={amount ?? undefined}
              aria-valuetext={
                error || amount === null
                  ? undefined
                  : plural(amount, unit.slice(0, -1))
              }
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              className="h-full w-full min-w-0 bg-transparent text-center font-mono text-[14px] tabular-nums outline-none"
            />
            <NumberField.Increment className={stepButton}>
              {icon("plus")}
            </NumberField.Increment>
          </NumberField.Group>
        </NumberField.Root>
        <RadioGroup
          aria-label="Unit"
          value={unit}
          onValueChange={(next) => changeUnit(next as Unit)}
          className={segmentList}
        >
          {UNITS.map((option) => (
            <Radio.Root
              key={option.value}
              value={option.value}
              className={segment}
            >
              {option.label}
            </Radio.Root>
          ))}
        </RadioGroup>
      </div>
      {error && (
        <div id={errorId} role="alert" className="text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}

export function BinTime({
  value,
  onChange,
  onErrorChange,
  note,
  warn,
}: {
  value: number;
  onChange: (hours: number) => void;
  onErrorChange: (error: string) => void;
  // What the chosen time means for the tabs in the bin.
  note: string;
  // The note says saving erases tabs.
  warn: boolean;
}) {
  const [custom, setCustom] = useState(() => !isPreset(value));
  const labelId = useId();
  const valueId = useId();
  return (
    <>
      <div className="dialog-row">
        <span className="stack">
          <span id={labelId}>Keep deleted tabs in the bin for</span>
          <span aria-live="polite" className={cn("sub", warn && "soon")}>
            {note}
          </span>
        </span>
        <Select
          value={custom ? CUSTOM : String(value)}
          onValueChange={(next) => {
            if (next === CUSTOM) setCustom(true);
            else if (typeof next === "string") {
              setCustom(false);
              onChange(Number(next));
            }
          }}
        >
          <SelectTrigger
            id="bin-time"
            aria-labelledby={`${labelId} ${valueId}`}
            className="w-fit min-w-28 shrink-0"
          >
            <SelectValue id={valueId}>
              {(selected: string) =>
                selected === CUSTOM
                  ? duration(value)
                  : PRESETS.find((p) => String(p.hours) === selected)?.label
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {PRESETS.map((preset) => (
              <SelectItem key={preset.hours} value={String(preset.hours)}>
                {preset.label}
              </SelectItem>
            ))}
            <SelectSeparator />
            <SelectItem value={CUSTOM}>Custom…</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {custom && (
        <AmountUnit
          value={value}
          onChange={onChange}
          onErrorChange={onErrorChange}
          labelledBy={labelId}
        />
      )}
    </>
  );
}
