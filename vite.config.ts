/* eslint-disable import/no-extraneous-dependencies */
import { resolve } from 'node:path'

import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import viteTsconfigPaths from 'vite-tsconfig-paths'
import * as packageJson from './package.json'

// https://vitejs.dev/config/
export default defineConfig((configEnv) => ({
    plugins: [
        viteTsconfigPaths(),
        dts({
            include: ['src/'],
        }),
    ],
    build: {
        lib: {
            entry: resolve('src', 'index.ts'),
            name: 'KeycloakJsProvider',
            formats: ['es', 'umd'],
            fileName: (format) => `keycloak-js-provider.${format}.js`
        },
        rollupOptions: {
            external: [...Object.keys(packageJson.peerDependencies)],
        },
    }
}))
