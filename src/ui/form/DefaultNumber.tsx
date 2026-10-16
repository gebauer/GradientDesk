import { NumberInput } from './NumberInput'

interface Props {
  id: string
  /** null = use `fallback` (shown in grey). */
  value: number | null
  fallback: number
  onChange: (value: number | null) => void
  /** Checkbox text, e.g. "Default". */
  checkLabel: string
  /** Accessible name of the checkbox, e.g. "Flow: use the standard flow". */
  checkName: string
  step?: string
  invalid?: boolean
  describedBy?: string
}

/**
 * Number with a "use the default" checkbox. Checked, the field shows the default in grey and
 * follows it; typing a value or unchecking makes it an own value.
 */
export function DefaultNumber({ id, value, fallback, onChange, checkLabel, checkName, step = '0.5', invalid, describedBy }: Props) {
  const isDefault = value === null
  return (
    <div className="default-row">
      <NumberInput
        id={id}
        step={step}
        min="0"
        value={value ?? fallback}
        onValue={(n) => onChange(n)}
        invalid={invalid}
        className={isDefault ? 'is-default' : undefined}
        aria-describedby={describedBy}
      />
      <label className="default-check">
        <input type="checkbox" aria-label={checkName} checked={isDefault} onChange={(e) => onChange(e.target.checked ? null : (value ?? fallback))} />
        {checkLabel}
      </label>
    </div>
  )
}
