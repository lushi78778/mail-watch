import react from '@vitejs/plugin-react'

export default ({ isSsrBuild }) => ({
  plugins: [react()],
  build: {
    outDir: isSsrBuild ? 'dist/server' : 'dist/client',
    rollupOptions: isSsrBuild ? {} : { input: 'index.html' },
  },
  ssr: {
    noExternal: [
      'class-variance-authority',
      'clsx',
      'tailwind-merge',
      'lucide-react',
    ],
  },
})
