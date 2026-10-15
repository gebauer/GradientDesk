import { useState, type InputHTMLAttributes } from 'react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number
  onValue: (n: number) => void
  invalid?: boolean
}

/**
 * Number input that keeps the typed text while editing ("1.", "") and only reports parsed numbers.
 * Shows the external value again when it changes from outside (e.g. dragging a handle).
 */
export function NumberInput({ value, onValue, invalid, className, onBlur, ...rest }: Props) {
  const [text, setText] = useState(String(value))
  const [last, setLast] = useState(value)
  if (value !== last) {
    setLast(value)
    if (parseFloat(text) !== value) setText(String(value))
  }
  return (
    <input
      {...rest}
      type="number"
      inputMode="decimal"
      className={`input${invalid ? ' invalid' : ''}${className ? ` ${className}` : ''}`}
      aria-invalid={invalid || undefined}
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        const n = parseFloat(e.target.value)
        if (Number.isFinite(n)) {
          setLast(n)
          onValue(n)
        }
      }}
      onBlur={(e) => {
        setText(String(value))
        onBlur?.(e)
      }}
    />
  )
}
