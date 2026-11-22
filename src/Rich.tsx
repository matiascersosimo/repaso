import Markdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
export default function Rich({ content }: { content: string }) {
  return <div className="rich"><Markdown skipHtml remarkPlugins={[remarkMath]}
    rehypePlugins={[[rehypeKatex, { trust: false, maxExpand: 100, maxSize: 10 }]]}
    components={{ a: ({ children }) => <span>{children}</span>, img: () => null }}>{content}</Markdown></div>
}
