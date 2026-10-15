import { useAppStore } from '../state/store'
import { StepRail } from './StepRail'
import { ApplicationStep } from './steps/ApplicationStep'
import { ColumnStep } from './steps/ColumnStep'
import { ExportStep } from './steps/ExportStep'
import { ProgramStep } from './steps/ProgramStep'
import { TopBar } from './TopBar'

export function AppShell() {
  const [state, dispatch] = useAppStore()
  const props = { state, dispatch }
  return (
    <div className="app">
      <TopBar {...props} />
      <div className="body">
        <StepRail {...props} />
        <div className="main-col">
          <main className="main">
            {state.step === 1 && <ApplicationStep {...props} />}
            {state.step === 2 && <ColumnStep {...props} />}
            {state.step === 3 && <ProgramStep {...props} />}
            {state.step === 4 && <ExportStep {...props} />}
          </main>
          <footer className="footer">
            GradientDesk v{__APP_VERSION__} · Not affiliated with or endorsed by Cytiva. Product names are trademarks of their respective owners.
          </footer>
        </div>
      </div>
    </div>
  )
}
