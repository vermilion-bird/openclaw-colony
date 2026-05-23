'use client'

import { Server, Shield, Settings, BarChart3, Container, Zap, Lock, Filter } from 'lucide-react'

function GithubIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
    </svg>
  )
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      {/* Header */}
      <header className="border-b border-slate-700">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
              <Server className="w-6 h-6" />
            </div>
            <span className="text-xl font-bold">OpenClaw Colony</span>
          </div>
          <a
            href="https://github.com/vermilion-bird/openclaw-colony"
            className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
          >
            <GithubIcon />
            <span>GitHub</span>
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <h1 className="text-5xl font-bold mb-6">
          OpenClaw AI 网关<span className="text-orange-500">集群管理平台</span>
        </h1>
        <p className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto">
          在单台宿主机上管理和监控多个 OpenClaw 代理实例，通过 Docker 实现快速部署、资源隔离和统一管理
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="https://github.com/vermilion-bird/openclaw-colony"
            className="px-6 py-3 bg-orange-500 hover:bg-orange-600 rounded-lg font-medium transition-colors"
          >
            快速开始
          </a>
          <a
            href="#features"
            className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors"
          >
            了解更多
          </a>
        </div>
      </section>

      {/* Architecture Diagram */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <div className="bg-slate-800 rounded-xl p-8 border border-slate-700">
          <h2 className="text-2xl font-bold mb-6 text-center">系统架构</h2>
          <div className="flex flex-col md:flex-row items-center justify-center gap-8">
            {/* Browser */}
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-blue-500 rounded-lg flex items-center justify-center mb-2">
                <BarChart3 className="w-8 h-8" />
              </div>
              <span className="text-sm text-slate-400">浏览器</span>
            </div>

            {/* Arrow */}
            <div className="text-slate-500 hidden md:block">→</div>

            {/* Colony Manager */}
            <div className="flex flex-col items-center bg-gradient-to-br from-orange-500/20 to-red-500/20 p-6 rounded-xl border border-orange-500/50">
              <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center mb-3">
                <Server className="w-10 h-10" />
              </div>
              <span className="font-bold">Colony Manager</span>
              <span className="text-xs text-slate-400 mt-1">Next.js + Dockerode</span>
            </div>

            {/* Arrow */}
            <div className="text-slate-500 hidden md:block">→</div>

            {/* Docker */}
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-cyan-500 rounded-lg flex items-center justify-center mb-2">
                <Container className="w-8 h-8" />
              </div>
              <span className="text-sm text-slate-400">Docker Socket</span>
            </div>

            {/* Arrow */}
            <div className="text-slate-500 hidden md:block">→</div>

            {/* OpenClaw Instances */}
            <div className="flex flex-col items-center">
              <div className="flex gap-2 mb-2">
                <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                  <Zap className="w-6 h-6" />
                </div>
                <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                  <Zap className="w-6 h-6" />
                </div>
                <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                  <Zap className="w-6 h-6" />
                </div>
              </div>
              <span className="text-sm text-slate-400">OpenClaw 实例</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold mb-12 text-center">核心功能</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {/* Instance Management */}
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 hover:border-orange-500/50 transition-colors">
            <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center mb-4">
              <Container className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold mb-2">实例管理</h3>
            <p className="text-slate-400 text-sm">
              创建、启动、停止、重启、删除 OpenClaw 实例，支持自定义镜像、端口、资源配置
            </p>
          </div>

          {/* Resource Monitoring */}
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 hover:border-blue-500/50 transition-colors">
            <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center mb-4">
              <BarChart3 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold mb-2">资源监控</h3>
            <p className="text-slate-400 text-sm">
              实时 CPU、内存使用率监控，流式日志查看，状态自动刷新
            </p>
          </div>

          {/* Security Module */}
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 hover:border-green-500/50 transition-colors">
            <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center mb-4">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold mb-2">安全模块</h3>
            <p className="text-slate-400 text-sm">
              三层安全防护：输入层防注入、处理层 PII 脱敏、输出层合规审查
            </p>
          </div>

          {/* Image Management */}
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 hover:border-cyan-500/50 transition-colors">
            <div className="w-12 h-12 bg-cyan-500 rounded-lg flex items-center justify-center mb-4">
              <Server className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold mb-2">镜像管理</h3>
            <p className="text-slate-400 text-sm">
              导入 Docker Hub/ghcr.io 镜像，自定义构建镜像，版本激活管理
            </p>
          </div>

          {/* User Management */}
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 hover:border-purple-500/50 transition-colors">
            <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center mb-4">
              <Settings className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold mb-2">用户管理</h3>
            <p className="text-slate-400 text-sm">
              Admin/Operator 双角色权限，用户创建、角色修改、审计日志
            </p>
          </div>

          {/* Feishu Integration */}
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 hover:border-yellow-500/50 transition-colors">
            <div className="w-12 h-12 bg-yellow-500 rounded-lg flex items-center justify-center mb-4">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold mb-2">飞书集成</h3>
            <p className="text-slate-400 text-sm">
              飞书机器人配置，私聊/群聊策略，白名单管理
            </p>
          </div>
        </div>
      </section>

      {/* Security Module Detail */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold mb-12 text-center">安全模块架构</h2>
        <div className="bg-slate-800 rounded-xl p-8 border border-slate-700">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Input Layer */}
            <div className="text-center">
              <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold mb-2 text-red-400">输入层</h3>
              <p className="text-sm text-slate-400 mb-3">防 Prompt 注入</p>
              <ul className="text-xs text-slate-500 space-y-1">
                <li>关键词快速扫描 &lt;50ms</li>
                <li>意图分类模型 ~150ms</li>
                <li>阻断恶意指令</li>
              </ul>
            </div>

            {/* Processing Layer */}
            <div className="text-center">
              <div className="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Filter className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold mb-2 text-yellow-400">处理层</h3>
              <p className="text-sm text-slate-400 mb-3">PII 识别脱敏</p>
              <ul className="text-xs text-slate-500 space-y-1">
                <li>身份证、手机、银行卡</li>
                <li>自定义规则扩展</li>
                <li>流式增量处理</li>
              </ul>
            </div>

            {/* Output Layer */}
            <div className="text-center">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold mb-2 text-green-400">输出层</h3>
              <p className="text-sm text-slate-400 mb-3">合规审查</p>
              <ul className="text-xs text-slate-500 space-y-1">
                <li>敏感词黑名单</li>
                <li>内容分类模型</li>
                <li>流式中断机制</li>
              </ul>
            </div>
          </div>

          {/* Flow arrow */}
          <div className="flex justify-center mt-8">
            <div className="flex items-center gap-4 text-slate-500">
              <span className="text-sm">用户消息</span>
              <span>→</span>
              <span className="text-red-400 text-sm">输入检查</span>
              <span>→</span>
              <span className="text-yellow-400 text-sm">PII脱敏</span>
              <span>→</span>
              <span className="text-sm">代理处理</span>
              <span>→</span>
              <span className="text-green-400 text-sm">输出审查</span>
              <span>→</span>
              <span className="text-sm">安全响应</span>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Start */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold mb-12 text-center">快速开始</h2>
        <div className="bg-slate-800 rounded-xl p-8 border border-slate-700">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="w-6 h-6 bg-orange-500 rounded flex items-center justify-center text-sm">1</span>
                克隆项目
              </h3>
              <code className="block bg-slate-900 p-3 rounded text-sm text-green-400">
                git clone https://github.com/vermilion-bird/openclaw-colony.git
              </code>
            </div>

            <div>
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="w-6 h-6 bg-orange-500 rounded flex items-center justify-center text-sm">2</span>
                配置环境变量
              </h3>
              <code className="block bg-slate-900 p-3 rounded text-sm text-green-400">
                cp .env.example .env<br/>
                # 编辑 .env 设置 NEXTAUTH_SECRET, ENCRYPTION_KEY 等
              </code>
            </div>

            <div>
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="w-6 h-6 bg-orange-500 rounded flex items-center justify-center text-sm">3</span>
                Docker Compose 启动
              </h3>
              <code className="block bg-slate-900 p-3 rounded text-sm text-green-400">
                docker-compose up -d
              </code>
            </div>

            <div>
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="w-6 h-6 bg-orange-500 rounded flex items-center justify-center text-sm">4</span>
                访问管理面板
              </h3>
              <code className="block bg-slate-900 p-3 rounded text-sm text-green-400">
                http://localhost:3000<br/>
                # 首次访问会引导创建 admin 账号
              </code>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold mb-12 text-center">技术栈</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { name: 'Next.js 16', color: 'bg-black' },
            { name: 'TypeScript', color: 'bg-blue-600' },
            { name: 'Prisma', color: 'bg-purple-600' },
            { name: 'Dockerode', color: 'bg-cyan-500' },
            { name: 'NextAuth.js', color: 'bg-indigo-500' },
            { name: 'Tailwind CSS', color: 'bg-sky-500' },
            { name: 'shadcn/ui', color: 'bg-slate-600' },
            { name: 'Vitest', color: 'bg-yellow-500' },
          ].map((tech) => (
            <div key={tech.name} className={`${tech.color} rounded-lg p-4 text-center font-medium`}>
              {tech.name}
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-4 gap-6 text-center">
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <div className="text-4xl font-bold text-orange-500 mb-2">202+</div>
            <div className="text-slate-400">测试用例</div>
          </div>
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <div className="text-4xl font-bold text-blue-500 mb-2">76%</div>
            <div className="text-slate-400">代码覆盖率</div>
          </div>
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <div className="text-4xl font-bold text-green-500 mb-2">3层</div>
            <div className="text-slate-400">安全防护</div>
          </div>
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <div className="text-4xl font-bold text-purple-500 mb-2">&lt;2s</div>
            <div className="text-slate-400">响应延迟</div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-700 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-slate-400 text-sm">
            © 2026 OpenClaw Colony. Apache 2.0 License.
          </div>
          <div className="flex gap-6 text-slate-400">
            <a href="https://github.com/vermilion-bird/openclaw-colony" className="hover:text-white transition-colors">
              GitHub
            </a>
            <a href="https://github.com/vermilion-bird/openclaw-colony/issues" className="hover:text-white transition-colors">
              Issues
            </a>
            <a href="https://github.com/vermilion-bird/openclaw-colony/blob/master/docs/superpowers/specs/2026-05-20-openclaw-colony-manager-design.md" className="hover:text-white transition-colors">
              设计文档
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}