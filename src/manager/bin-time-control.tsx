// The bin time in Options: a Luma select of common lengths, and Custom for an
// amount in hours or days.
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
// Luma's tabs list and trigger styles, on radios: a unit is a choice, not a
// tab.
const segmentList =
  "inline-flex h-9 w-full shrink-0 items-center justify-center gap-0 rounded-full bg-muted p-1 text-muted-foreground @2xs:w-fit";
const segment =
  "relative inline-flex h-full flex-1 cursor-default items-center justify-center rounded-full border border-transparent px-3 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all outline-none select-none hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-muted-foreground dark:hover:text-foreground data-checked:bg-raised data-checked:text-foreground data-checked:shadow-sm dark:data-checked:border-input dark:data-checked:bg-input dark:data-checked:text-foreground";
const stepButton = cn(
  buttonVariants({ variant: "ghost", size: "icon-sm" }),
  "shrink-0 shadow-none",
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
      className="@container flex flex-col gap-2 animate-in duration-150 fade-in-0 slide-in-from-top-1"
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
            className="group/input-group relative flex h-9 w-full min-w-0 items-center rounded-4xl border border-transparent bg-input/50 px-0.5 transition-[color,box-shadow,background-color] outline-none has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-3 has-[[data-slot=input-group-control]:focus-visible]:ring-ring/30 has-[[aria-invalid=true]]:border-destructive has-[[aria-invalid=true]]:ring-3 has-[[aria-invalid=true]]:ring-destructive/20 @2xs:w-34"
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
              className="h-full w-full min-w-0 bg-transparent text-center font-mono text-sm tabular-nums outline-none"
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
        <div id={errorId} role="alert" className="text-sm text-destructive">
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
}: {
  value: number;
  onChange: (hours: number) => void;
  onErrorChange: (error: string) => void;
}) {
  const [custom, setCustom] = useState(() => !isPreset(value));
  const labelId = useId();
  const valueId = useId();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span id={labelId} className="text-sm leading-snug">
          Keep deleted tabs in the bin for
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
            className="w-fit min-w-36"
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
    </div>
  );
}
