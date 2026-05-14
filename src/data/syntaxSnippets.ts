export type SyntaxSnippet = {
  /** 展示名称 */
  title: string
  /** 简短说明 */
  hint: string
  /** 插入到光标处的模板 */
  template: string
}

/**
 * 内置常用语法模板，便于新手一键插入。
 */
export const SYNTAX_SNIPPETS: SyntaxSnippet[] = [
  {
    title: '一级标题',
    hint: '行首使用 # 加一个空格',
    template: '\n# 标题\n\n',
  },
  {
    title: '二级标题',
    hint: '',
    template: '\n## 小标题\n\n',
  },
  {
    title: '粗体与斜体',
    hint: '',
    template: '这是**粗体**，这是*斜体*。',
  },
  {
    title: '无序列表',
    hint: '',
    template: '\n- 第一项\n- 第二项\n- 第三项\n\n',
  },
  {
    title: '有序列表',
    hint: '',
    template: '\n1. 第一步\n2. 第二步\n3. 第三步\n\n',
  },
  {
    title: '引用',
    hint: '',
    template: '\n> 这是一段引用文字。\n\n',
  },
  {
    title: '行内代码',
    hint: '',
    template: '使用 `npm run dev` 启动开发服务器。',
  },
  {
    title: '代码块',
    hint: '从 VS Code 等工具复制代码后可直接粘贴到块内',
    template: '\n```ts\n// 在此粘贴代码\nconst x = 1\n```\n\n',
  },
  {
    title: '链接',
    hint: '',
    template: '[链接文字](https://example.com)',
  },
  {
    title: '图片（网络地址）',
    hint: '粘贴截图会插入引用式（短行 + 文末定义）；图片在左侧预览中查看',
    template: '\n![说明文字](https://example.com/image.png)\n\n',
  },
  {
    title: '分隔线',
    hint: '',
    template: '\n---\n\n',
  },
  {
    title: '简单表格',
    hint: '',
    template: '\n| 列A | 列B |\n| --- | --- |\n| 1 | 2 |\n\n',
  },
]
