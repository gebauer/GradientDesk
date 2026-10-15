interface Props<T extends string> {
  value: T
  options: readonly T[]
  onChange: (v: T) => void
  label: string
}

export function Segmented<T extends string>({ value, options, onChange, label }: Props<T>) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o} type="button" className={o === value ? 'on' : ''} aria-pressed={o === value} onClick={() => onChange(o)}>
          {o}
        </button>
      ))}
    </div>
  )
}
