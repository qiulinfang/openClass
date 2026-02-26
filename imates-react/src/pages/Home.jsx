export default function Home() {
  return (
    <section className="card">
      <h1 className="title">用 React 写一个页面</h1>
      <p className="muted">
        这是一个最小示例：组件 + 路由 + 样式。
      </p>

      <div className="grid">
        <div className="tile">
          <div className="tileTitle">1. 页面就是组件</div>
          <div className="tileBody">每个页面通常是一个函数组件，返回 JSX。</div>
        </div>
        <div className="tile">
          <div className="tileTitle">2. 用路由切换页面</div>
          <div className="tileBody">用 react-router-dom 的 Routes/Route 定义路径。</div>
        </div>
        <div className="tile">
          <div className="tileTitle">3. 样式</div>
          <div className="tileBody">这里用一个全局 styles.css 做最简单演示。</div>
        </div>
      </div>

      <div className="actions">
        <a className="button" href="https://react.dev/" target="_blank" rel="noreferrer">
          React 文档
        </a>
        <a className="button secondary" href="https://vitejs.dev/" target="_blank" rel="noreferrer">
          Vite 文档
        </a>
      </div>
    </section>
  )
}
