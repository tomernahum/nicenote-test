/*

    Parts of the app:
    - Month View
    - Day View
    - Add Event button / modal
    





*/
import { Calendar } from './components/Calendar';
import './styles.css';

function App() {
    return (
        <div className="app-container">
            <header className="app-header">
                <h1>Calendar App</h1>
            </header>
            <main className="app-main">
                <Calendar />
            </main>
        </div>
    )
}

export default App
