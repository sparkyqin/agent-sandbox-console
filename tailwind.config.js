/** @type {import('tailwindcss').Config} */
export default {
  // 只扫描根目录的 tsx/ts，避免递归进子目录的调研缓存文件
  content: ['./index.html', './*.tsx', './*.ts'],
  theme: { extend: {} },
  plugins: [],
}
