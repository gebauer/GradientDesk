interface Props {
  on: boolean
  onChange: (on: boolean) => void
  labelOn: string
  labelOff: string
  id?: string
}

export function Toggle({ on, onChange, labelOn, labelOff, id }: Props) {
  return (
    <button type="button" id={id} className={`toggle${on ? ' on' : ''}`} aria-pressed={on} onClick={() => onChange(!on)}>
      {on ? labelOn : labelOff}
    </button>
  )
}
