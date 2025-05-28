import type { Plugin } from 'vite'
import process from 'node:process'
import path from 'node:path'
import glob from 'fast-glob'
import fs from 'node:fs/promises'
import console from 'node:console'

export type Options = {
  entryFilePath?: string
}

export const dtscompat4deno = (options: Options): Plugin => {
  let outDir = 'dist'
  const entryFiles: string[] = []

  return {
    name: 'dtscompat4deno',

    configResolved(config) {
      outDir = config.build.outDir || 'dist'
    },

    generateBundle(_options, bundle) {
      entryFiles.length = 0
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'chunk' && chunk.isEntry) {
          entryFiles.push(fileName)
        }
      }
    },

    async writeBundle() {
      const distPath = path.resolve(process.cwd(), outDir)

      // 处理所有.d.ts文件
      const dtsFiles = await glob('**/*.d.ts', {
        cwd: distPath,
        absolute: true,
        ignore: ['**/node_modules/**'],
      })

      const importRegex =
        /(from\s+["'])(.*?)(\.(js|ts|mjs|cjs|tsx|jsx))(\?.*?)?(["'])/g

      for (const filePath of dtsFiles) {
        try {
          let content = await fs.readFile(filePath, 'utf-8')
          content = content.replace(
            importRegex,
            (_, start, path, _ext, _extType, query, end) => {
              return `${start}${path}.d.ts${query || ''}${end}`
            }
          )
          await fs.writeFile(filePath, content)
        } catch (e) {
          console.error(`Process file ${filePath} failed:`, e)
        }
      }

      // 为入口文件添加注释
      for (const entry of entryFiles) {
        const entryPath = path.join(distPath, entry)
        try {
          if (
            await fs
              .access(entryPath)
              .then(() => true)
              .catch(() => false)
          ) {
            let content = await fs.readFile(entryPath, 'utf-8')
            content = `// @ts-self-types="${
              options.entryFilePath || './lib.d.ts'
            }"\n${content}`
            await fs.writeFile(entryPath, content)
          }
        } catch (e) {
          console.error(`Process entry file ${entryPath} failed:`, e)
        }
      }
    },
  }
}
