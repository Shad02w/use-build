import { useState } from "react"
import reactLogo from "./assets/react.svg"
import viteLogo from "/vite.svg"
import "./App.css"
import { uuid } from "./util/uuid"
import { postId } from "./util/post-id"
import { userId } from "./util/user-id"

function App() {
    const [count, setCount] = useState(0)

    return (
        <>
            <div>
                <a href="https://vite.dev" target="_blank">
                    <img src={viteLogo} className="logo" alt="Vite logo" />
                </a>
                <a href="https://react.dev" target="_blank">
                    <img src={reactLogo} className="logo react" alt="React logo" />
                </a>
            </div>
            <h1>Vite + React</h1>
            <div className="card">
                <button onClick={() => setCount(count => count + 1)}>count is {count}</button>
                <p>
                    Edit <code>src/App.tsx</code> and save to test HMR
                </p>
                <div data-testid="build-values">
                    <p data-testid="build-uuid">uuid: {uuid}</p>
                    <p data-testid="build-post-id">postId: {postId}</p>
                    <p data-testid="build-user-id">userId: {userId}</p>
                </div>
            </div>
            <p className="read-the-docs">Click on the Vite and React logos to learn more</p>
        </>
    )
}

export default App
