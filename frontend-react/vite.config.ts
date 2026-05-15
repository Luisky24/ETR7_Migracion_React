import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/// <reference types="vitest/config" />

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const isGas = mode === 'gas'

  return {
    plugins: [react()],
    base: isGas ? './' : '/',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: isGas
      ? {
          cssCodeSplit: false,
          /** Un solo chunk JS/CSS para inyectar vía HtmlService `include()`. */
          codeSplitting: false,
        }
      : undefined,
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  }
})
