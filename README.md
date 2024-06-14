# vite-plugin-use-build

This vite plugin help you to evaluate export values of esm module at build time, also allow you to import the values at runtime 

## Usage

use `use build` directive to declare a build time file, in following code snippet, `fetchMessage` and zod schema validation is done at build time

```tsx
// env.ts
"use build"

import { z } from "zod"
import { envSchema } from "./env-schema"

async function fetchMessage() {
    console.log("should only run on build time")
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
    await delay(1000)
    return "Hello world"
}

export const env = envSchema.parse(import.meta.env)

export const message = z.string().parse(await fetchMessage())

export default 123
```

and you can use all export values by directly importing the build time file at runtime

```tsx
import { useState } from "react"
import { container } from "./index.css"
import { message } from "./env"

export function Main() {
    const [count, setCount] = useState(0)

    return (
        <div className={container}>
            <button onClick={() => setCount(count => count + 1)}>count: {count}</button>
            <p>{message}</p>
        </div>
    )
}
```

## Setup

```shell
npm install -D use-build
```

```tsx
// vite.config.ts
import { defineConfig } from "vite"
import { UseBuildPlugin } from "use-build/vite"
import react from "@vitejs/plugin-react"

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react(), UseBuildPlugin()]
})
```

## Caveat

**All export values from build time file must be serializable.**

## Todo

- [ ] HMR

- [ ] Tests

- [ ] add support for `.build.{ts,tsx,js,jsx}` files

- [ ] allow other plugins to run at vite runtime

## Inspirations

[GitHub - t3-oss/t3-env](https://github.com/t3-oss/t3-env)

[GitHub - egoist/vite-plugin-compile-time: Some compile-time magic for your Vite project](https://github.com/egoist/vite-plugin-compile-time)

## License

[MIT](LICENSE).
